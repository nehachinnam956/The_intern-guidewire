// weather.js
const router = require('express').Router();
const axios = require('axios');
const { query } = require('../db');

router.get('/check/:store_id', async (req, res) => {
  try {
    const store = await query(req.db, `SELECT * FROM dark_stores WHERE id=?`, [req.params.store_id]);
    if (!store.rows.length) return res.status(404).json({ error: 'Store not found' });
    const s = store.rows[0];
    const OWM_KEY = process.env.OPENWEATHER_API_KEY;
    let weather = { temperature: 32, rain_1h_mm: 0, humidity: 65, flood_trigger: false, heat_trigger: false, source: 'Demo' };
    let aqi = { aqi: 120, aqi_trigger: false, source: 'Demo AQI' };

    if (OWM_KEY && OWM_KEY !== 'your_openweathermap_api_key') {
      try {
        const [wRes, aRes] = await Promise.all([
          axios.get(`https://api.openweathermap.org/data/2.5/weather?lat=${s.lat}&lon=${s.lng}&appid=${OWM_KEY}&units=metric`),
          axios.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${s.lat}&lon=${s.lng}&appid=${OWM_KEY}`)
        ]);
        const w = wRes.data;
        weather = {
          source: 'OpenWeatherMap Live',
          temperature: w.main?.temp || 32,
          humidity: w.main?.humidity || 65,
          rain_1h_mm: w.rain?.['1h'] || 0,
          rain_3h_mm: w.rain?.['3h'] || 0,
          weather_main: w.weather?.[0]?.main || 'Clear',
          flood_trigger: (w.rain?.['1h'] || 0) >= 13.3,
          heat_trigger: (w.main?.temp || 0) >= 45,
        };
        const aqiRaw = aRes.data.list?.[0]?.main?.aqi || 1;
        const aqiScaled = aqiRaw * 80;
        aqi = { aqi: aqiScaled, aqi_trigger: aqiScaled >= 300, source: 'OpenWeather Air Pollution API' };
      } catch(e) { console.log('Weather API error:', e.message); }
    }

    const active_triggers = [];
    if (weather.flood_trigger) active_triggers.push({ type:'flood', label:'Flash Flood / Heavy Rain', evidence:`${weather.rain_1h_mm}mm/hr` });
    if (weather.heat_trigger) active_triggers.push({ type:'heat', label:'Extreme Heat Advisory', evidence:`${weather.temperature}°C` });
    if (aqi.aqi_trigger) active_triggers.push({ type:'aqi', label:'Severe Air Pollution', evidence:`AQI ${aqi.aqi}` });

    res.json({ store: s, weather, aqi, active_triggers, checked_at: new Date() });
  } catch(err) { res.status(500).json({ error: 'Weather check failed' }); }
});

module.exports = router;
