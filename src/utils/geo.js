const calcDistance = (a, b) => {
  const rad = Math.PI / 180;
  let lat1 = a.latiitude;
  const lon1 = a.longitude;
  let lat2 = b.latitude;
  const lon2 = b.longitude;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  lat1 *= rad;
  lat2 *= rad;
  const x = Math.sin(dLat / 2);
  const y = Math.sin(dLon / 2);
  const dist = x * x + y * y * Math.cos(lat1) * Math.cos(lat2);
  return Math.atan2(Math.sqrt(dist), Math.sqrt(1 - dist));
};

module.exports = { calcDistance };
