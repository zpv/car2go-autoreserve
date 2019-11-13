const calcDistance = (a, b) => {
  const lat1 = a.latitude;
  const lon1 = a.longitude;
  const lat2 = b.latitude;
  const lon2 = b.longitude;

  const p = 0.017453292519943295; // Math.PI / 180
  const c = Math.cos;
  const d = 0.5 - c((lat2 - lat1) * p) / 2
          + c(lat1 * p) * c(lat2 * p)
          * (1 - c((lon2 - lon1) * p)) / 2;

  return 12742 * Math.asin(Math.sqrt(d)); // 2 * R; R = 6371 km
};

module.exports = { calcDistance };
