import { useState, FormEvent, useEffect } from 'react';
import { MapContainer, TileLayer, Circle, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import 'leaflet/dist/leaflet.css';
import './App.css';

// Custom Heatmap Layer Component using leaflet.heat
function HeatmapLayer({ points }: { points: any[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Intensity normalization for a darker, more vibrant feel
    const heatData = points.map(p => [
      p.lat, 
      p.lng, 
      p.pm / 120 
    ]);

    const heatLayer = (L as any).heatLayer(heatData, {
      radius: 45, // Larger radius for more overlap
      blur: 25,   // Higher blur for smooth gradients
      maxZoom: 10,
      gradient: {
        0.1: '#3182ce', // Cool (Blue)
        0.2: '#4fd1c5', // Cyan
        0.4: '#f6e05e', // Moderate (Yellow)
        0.6: '#ed8936', // Hot (Orange)
        0.8: '#e53e3e', // Severe (Red)
        1.0: '#742a2a'  // Dangerous (Dark Maroon)
      }
    }).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
}

// ... existing interfaces ...

interface Factor {
  feature: string;
  value: number;
  shap_value: number;
  effect: string;
}

interface PredictionResult {
  latitude: number;
  longitude: number;
  nearest_grid_latitude: number;
  nearest_grid_longitude: number;
  year: number;
  month: number;
  predicted_pm25: number;
  actual_pm25?: number;
  approximate_accuracy?: number;
  top_factors?: Factor[];
  meteorological_factors?: Factor[];
}

interface City {
  name: string;
  lat: string;
  lon: string;
}

const PUNE_CITIES: City[] = [
  { name: 'Custom Location', lat: '', lon: '' },
  { name: 'Shivajinagar', lat: '18.5308', lon: '73.8475' },
  { name: 'Kothrud', lat: '18.5074', lon: '73.8077' },
  { name: 'Viman Nagar', lat: '18.5679', lon: '73.9143' },
  { name: 'Hinjewadi', lat: '18.5913', lon: '73.7389' },
  { name: 'Hadapsar', lat: '18.4967', lon: '73.9417' },
  { name: 'Baner', lat: '18.5597', lon: '73.7799' },
];

function App() {
  const [view, setView] = useState<'predictor' | 'heatmap'>('predictor');
  const [mapMode, setMapMode] = useState<'markers' | 'gradient'>('markers');
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.getAttribute('data-theme') === 'dark');
  const [useCity, setUseCity] = useState(true);
  const [selectedCity, setSelectedCity] = useState(PUNE_CITIES[1].name);
  const [lat, setLat] = useState(PUNE_CITIES[1].lat);
  const [lon, setLon] = useState(PUNE_CITIES[1].lon);
  const [year, setYear] = useState('2023');
  const [month, setMonth] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Clustered Geo-coordinates for a fuller, more colorful map
  const generateMockHeatmap = () => {
    const points = [];
    const hubs = [
      { lat: 28.61, lng: 77.20, basePM: 180 }, // Delhi
      { lat: 19.07, lng: 72.87, basePM: 150 }, // Mumbai
      { lat: 12.97, lng: 77.59, basePM: 120 }, // Bangalore
      { lat: 22.57, lng: 88.36, basePM: 140 }, // Kolkata
      { lat: 17.38, lng: 78.48, basePM: 130 }, // Hyderabad
      { lat: 23.02, lng: 72.57, basePM: 160 }, // Ahmedabad
      { lat: 18.52, lng: 73.85, basePM: 110 }, // Pune
      { lat: 26.84, lng: 80.94, basePM: 140 }, // Lucknow
    ];

    // Generate clusters around hubs
    hubs.forEach(hub => {
      for (let i = 0; i < 50; i++) {
        points.push({
          id: `h-${hub.lat}-${i}`,
          lat: hub.lat + (Math.random() - 0.5) * 6, // Concentrated but broad spread
          lng: hub.lng + (Math.random() - 0.5) * 6,
          pm: hub.basePM + (Math.random() - 0.5) * 60
        });
      }
    });

    // Background noise to fill the gaps
    for (let i = 0; i < 200; i++) {
      points.push({
        id: `n-${i}`,
        lat: 8.4 + Math.random() * (37.6 - 8.4),
        lng: 68.7 + Math.random() * (97.2 - 68.7),
        pm: Math.floor(Math.random() * 80) + 10
      });
    }
    return points;
  };
  const [heatmapData, setHeatmapData] = useState(generateMockHeatmap());

  useEffect(() => {
    if (view === 'heatmap') {
      window.dispatchEvent(new Event('resize'));
    }
  }, [view]);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    document.documentElement.setAttribute('data-theme', newMode ? 'dark' : 'light');
  };

  const handleCityChange = (cityName: string) => {
    setSelectedCity(cityName);
    const city = PUNE_CITIES.find(c => c.name === cityName);
    if (city && city.name !== 'Custom Location') {
      setLat(city.lat);
      setLon(city.lon);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const payload = {
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      year: parseInt(year),
      month: parseInt(month),
    };

    try {
      const response = await fetch('http://localhost:8000/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to fetch prediction');
      }

      const data = await response.json();
      setResult(data);
      setShowResult(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowResult(false);
    setResult(null);
  };

  const getPMColor = (pm: number) => {
    if (pm <= 30) return '#48BB78'; // Good
    if (pm <= 60) return '#ECC94B'; // Satisfactory
    if (pm <= 90) return '#ED8936'; // Moderate
    if (pm <= 120) return '#E53E3E'; // Poor
    return '#822727'; // Very Poor/Severe
  };

  const getPMLabel = (pm: number) => {
    if (pm <= 30) return 'Good';
    if (pm <= 60) return 'Satisfactory';
    if (pm <= 90) return 'Moderate';
    if (pm <= 120) return 'Poor';
    return 'Severe';
  };

  return (
    <div className={`container ${isDarkMode ? 'dark' : 'light'}`}>
      <nav className="main-nav">
        <div className="nav-links">
          <button 
            className={`nav-link ${view === 'predictor' ? 'active' : ''}`}
            onClick={() => { setView('predictor'); setShowResult(false); }}
          >
            📊 Predictor
          </button>
          <button 
            className={`nav-link ${view === 'heatmap' ? 'active' : ''}`}
            onClick={() => setView('heatmap')}
          >
            🗺️ Interactive Heatmap
          </button>
        </div>
        <div className="theme-toggle-container">
          <button onClick={toggleTheme} className="theme-toggle-btn">
            {isDarkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </nav>

      <header className={showResult || view === 'heatmap' ? 'minimal' : ''}>
        <h1>Pune PM<sub>2.5</sub> {view === 'heatmap' ? 'Heatmap' : 'Predictor'}</h1>
        {!showResult && view === 'predictor' && <p className="subtitle">High-resolution monthly air quality forecasting for Pune City</p>}
        {view === 'heatmap' && <p className="subtitle">Live spatial distribution of PM<sub>2.5</sub> across the region (Simulated)</p>}
      </header>

      {view === 'heatmap' ? (
        <div className="heatmap-view animate-fade-in">
          <div className="map-container card">
            <div className="leaflet-wrapper">
              <MapContainer 
                center={[20.5937, 78.9629]} 
                zoom={5} 
                scrollWheelZoom={true}
                className="india-leaflet-map"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {mapMode === 'markers' ? (
                  heatmapData.map(point => (
                    <Circle
                      key={point.id}
                      center={[point.lat, point.lng]}
                      pathOptions={{ 
                        fillColor: getPMColor(point.pm), 
                        color: getPMColor(point.pm),
                        fillOpacity: 0.6,
                        weight: 1
                      }}
                      radius={30000}
                    >
                      <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                        <div className="map-tooltip">
                          <strong>PM<sub>2.5</sub>: {point.pm} µg/m³</strong><br/>
                          <span>Status: {getPMLabel(point.pm)}</span>
                        </div>
                      </Tooltip>
                    </Circle>
                  ))
                ) : (
                  <HeatmapLayer points={heatmapData} />
                )}
              </MapContainer>
              <div className="map-legend">
                <div className="legend-item"><span style={{backgroundColor: '#48BB78'}}></span> Good</div>
                <div className="legend-item"><span style={{backgroundColor: '#ECC94B'}}></span> Moderate</div>
                <div className="legend-item"><span style={{backgroundColor: '#ED8936'}}></span> Poor</div>
                <div className="legend-item"><span style={{backgroundColor: '#E53E3E'}}></span> Severe</div>
              </div>
            </div>
            <div className="map-controls">
              <div className="mode-toggle-group">
                <button 
                  className={`toggle-btn ${mapMode === 'markers' ? 'active' : ''}`}
                  onClick={() => setMapMode('markers')}
                >
                  📍 Points
                </button>
                <button 
                  className={`toggle-btn ${mapMode === 'gradient' ? 'active' : ''}`}
                  onClick={() => setMapMode('gradient')}
                >
                  🔥 Gradient
                </button>
              </div>
              <button className="predict-btn" onClick={() => setHeatmapData(generateMockHeatmap())}>🔄 Randomize Data</button>
            </div>
          </div>
        </div>
      ) : (
        !showResult ? (
          <div className="input-view animate-fade-in">
            <section className="input-section card">
              <div className="section-header">
                <h2>Predictor Settings</h2>
                <div className="toggle-container">
                  <button 
                    className={`toggle-btn ${useCity ? 'active' : ''}`}
                    onClick={() => setUseCity(true)}
                  >
                    By City
                  </button>
                  <button 
                    className={`toggle-btn ${!useCity ? 'active' : ''}`}
                    onClick={() => setUseCity(false)}
                  >
                    By Coords
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                {useCity ? (
                  <div className="form-group animate-fade-in">
                    <label htmlFor="city">Select Area in Pune</label>
                    <select
                      id="city"
                      value={selectedCity}
                      onChange={(e) => handleCityChange(e.target.value)}
                    >
                      {PUNE_CITIES.filter(c => c.name !== 'Custom Location').map(city => (
                        <option key={city.name} value={city.name}>{city.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-row animate-fade-in">
                    <div className="form-group">
                      <label htmlFor="lat">Latitude (18.40 - 18.70)</label>
                      <input
                        id="lat"
                        type="number"
                        step="0.0001"
                        min="18.40"
                        max="18.70"
                        value={lat}
                        onChange={(e) => setLat(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="lon">Longitude (73.70 - 74.10)</label>
                      <input
                        id="lon"
                        type="number"
                        step="0.0001"
                        min="73.70"
                        max="74.10"
                        value={lon}
                        onChange={(e) => setLon(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="year">Year</label>
                    <input
                      id="year"
                      type="number"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="month">Month</label>
                    <select
                      id="month"
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      required
                    >
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {new Date(0, i).toLocaleString('default', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="predict-btn">
                  {loading ? 'Analyzing Data...' : 'Get Prediction'}
                </button>
              </form>
              {error && <div className="error-msg">{error}</div>}
            </section>
          </div>
        ) : (
          <div className="result-view animate-slide-up">
            {result && (
              <div className="result-container">
                <div className="pm-center-bar card" style={{ borderLeftColor: getPMColor(result.predicted_pm25) }}>
                  <div className="pm-main-info">
                    <div className="pm-display">
                      <span className="pm-label">Predicted PM<sub>2.5</sub></span>
                      <span className="pm-value" style={{ color: getPMColor(result.predicted_pm25) }}>
                        {result.predicted_pm25}
                      </span>
                      <span className="pm-unit">µg/m³</span>
                    </div>
                    <div className="pm-status-badge" style={{ backgroundColor: getPMColor(result.predicted_pm25) }}>
                      {getPMLabel(result.predicted_pm25)}
                    </div>
                  </div>

                  <div className="result-details-grid">
                    <div className="detail-item">
                      <span className="detail-label">Location</span>
                      <span className="detail-value">{useCity ? selectedCity : `${result.latitude.toFixed(3)}, ${result.longitude.toFixed(3)}`}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Period</span>
                      <span className="detail-value">{new Date(result.year, result.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Grid Point</span>
                      <span className="detail-value">{result.nearest_grid_latitude.toFixed(3)}N, {result.nearest_grid_longitude.toFixed(3)}E</span>
                    </div>
                  </div>
                </div>

                <div className="action-buttons">
                  <button onClick={resetForm} className="back-btn">← Back to Settings</button>
                  <button onClick={() => window.print()} className="print-btn">Download Report</button>
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

export default App;
