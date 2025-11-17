/**
 * Spatial Index using QuadTree for efficient geographic queries
 * Adapted from mtc-app-src/hooks/useMarkerOverlay.tsx
 */

export interface Point {
  lat: number;
  lng: number;
  id: string;
}

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

class QuadTreeNode {
  private bounds: Bounds;
  private points: Point[];
  private children: QuadTreeNode[] | null;
  private maxPoints: number;
  private maxLevel: number;
  private level: number;

  constructor(bounds: Bounds, level: number = 0, maxPoints: number = 8, maxLevel: number = 6) {
    this.bounds = bounds;
    this.points = [];
    this.children = null;
    this.maxPoints = maxPoints;
    this.maxLevel = maxLevel;
    this.level = level;
  }

  private subdivide(): void {
    const { north, south, east, west } = this.bounds;
    const midLat = (north + south) / 2;
    const midLng = (east + west) / 2;

    // Create 4 quadrants: NW, NE, SW, SE
    this.children = [
      new QuadTreeNode(
        { north, south: midLat, east: midLng, west },
        this.level + 1,
        this.maxPoints,
        this.maxLevel
      ), // NW
      new QuadTreeNode(
        { north, south: midLat, east, west: midLng },
        this.level + 1,
        this.maxPoints,
        this.maxLevel
      ), // NE
      new QuadTreeNode(
        { north: midLat, south, east: midLng, west },
        this.level + 1,
        this.maxPoints,
        this.maxLevel
      ), // SW
      new QuadTreeNode(
        { north: midLat, south, east, west: midLng },
        this.level + 1,
        this.maxPoints,
        this.maxLevel
      ), // SE
    ];

    // Redistribute points to children
    for (const point of this.points) {
      for (const child of this.children) {
        if (child.contains(point)) {
          child.insert(point);
          break;
        }
      }
    }

    this.points = [];
  }

  private contains(point: Point): boolean {
    const { lat, lng } = point;
    const { north, south, east, west } = this.bounds;
    return lat >= south && lat <= north && lng >= west && lng <= east;
  }

  private intersects(bounds: Bounds): boolean {
    return !(
      bounds.south > this.bounds.north ||
      bounds.north < this.bounds.south ||
      bounds.west > this.bounds.east ||
      bounds.east < this.bounds.west
    );
  }

  insert(point: Point): boolean {
    if (!this.contains(point)) {
      return false;
    }

    // If we have children, insert into appropriate child
    if (this.children) {
      for (const child of this.children) {
        if (child.insert(point)) {
          return true;
        }
      }
      return false;
    }

    // Add point to this node
    this.points.push(point);

    // Subdivide if we've exceeded capacity and haven't reached max level
    if (this.points.length > this.maxPoints && this.level < this.maxLevel) {
      this.subdivide();
    }

    return true;
  }

  query(bounds: Bounds, found: Point[] = []): Point[] {
    // If bounds don't intersect, return empty
    if (!this.intersects(bounds)) {
      return found;
    }

    // If we have children, query them
    if (this.children) {
      for (const child of this.children) {
        child.query(bounds, found);
      }
    } else {
      // Check points in this node
      for (const point of this.points) {
        if (
          point.lat >= bounds.south &&
          point.lat <= bounds.north &&
          point.lng >= bounds.west &&
          point.lng <= bounds.east
        ) {
          found.push(point);
        }
      }
    }

    return found;
  }

  clear(): void {
    this.points = [];
    this.children = null;
  }
}

export class SpatialIndex {
  private root: QuadTreeNode;

  constructor() {
    // Initialize with world bounds
    this.root = new QuadTreeNode({
      north: 85,
      south: -85,
      east: 180,
      west: -180,
    });
  }

  addPoint(lat: number, lng: number, id: string): void {
    this.root.insert({ lat, lng, id });
  }

  getPointsInBounds(bounds: Bounds): Point[] {
    return this.root.query(bounds);
  }

  clear(): void {
    this.root.clear();
  }

  rebuild(points: Point[]): void {
    this.clear();
    for (const point of points) {
      this.addPoint(point.lat, point.lng, point.id);
    }
  }
}

/**
 * Expands bounds by a percentage to create a buffer zone
 */
export function expandBounds(bounds: Bounds, percentage: number = 0.1): Bounds {
  const latDelta = (bounds.north - bounds.south) * percentage;
  const lngDelta = (bounds.east - bounds.west) * percentage;

  return {
    north: bounds.north + latDelta,
    south: bounds.south - latDelta,
    east: bounds.east + lngDelta,
    west: bounds.west - lngDelta,
  };
}

/**
 * Converts Google Maps LatLngBounds to our Bounds interface
 */
export function googleBoundsToBounds(bounds: google.maps.LatLngBounds): Bounds {
  return {
    north: bounds.getNorthEast().lat(),
    south: bounds.getSouthWest().lat(),
    east: bounds.getNorthEast().lng(),
    west: bounds.getSouthWest().lng(),
  };
}
