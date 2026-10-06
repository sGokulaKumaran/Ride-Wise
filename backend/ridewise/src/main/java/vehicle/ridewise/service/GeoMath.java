package vehicle.ridewise.service;

// Small geometry helpers shared by the fleet services.
final class GeoMath {

    private static final double EARTH_RADIUS_M = 6_371_000.0;

    private GeoMath() {}

    /** Great-circle distance between two points, in metres (Haversine). */
    static double distanceMeters(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    static boolean validLatLng(Double lat, Double lng) {
        return lat != null && lng != null && !lat.isNaN() && !lng.isNaN()
                && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    }

    /** A finite, non-negative number — or null when the value is unusable. */
    static Double nonNegative(Double value) {
        if (value == null || value.isNaN() || value.isInfinite() || value < 0) return null;
        return value;
    }
}
