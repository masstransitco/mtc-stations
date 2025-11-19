/**
 * Material Palette
 *
 * Reusable THREE.js materials for building rendering.
 * Instead of creating a new material for every building, we maintain
 * a small palette of materials (one per color) and reuse them.
 */

import * as THREE from 'three';

export class MaterialPalette {
  private materials: Map<string, THREE.MeshLambertMaterial> = new Map();
  private opacity: number;

  constructor(opacity: number = 0.8) {
    this.opacity = opacity;
  }

  /**
   * Get or create a material for a given color
   */
  getMaterial(color: string): THREE.MeshLambertMaterial {
    let material = this.materials.get(color);

    if (!material) {
      material = new THREE.MeshLambertMaterial({
        color: color,
        opacity: this.opacity,
        transparent: this.opacity < 1,
      });
      this.materials.set(color, material);
    }

    return material;
  }

  /**
   * Update opacity for all materials
   */
  setOpacity(opacity: number): void {
    this.opacity = opacity;
    this.materials.forEach(material => {
      material.opacity = opacity;
      material.transparent = opacity < 1;
      material.needsUpdate = true;
    });
  }

  /**
   * Get current opacity
   */
  getOpacity(): number {
    return this.opacity;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      materialCount: this.materials.size,
      colors: Array.from(this.materials.keys()),
    };
  }

  /**
   * Dispose all materials
   */
  dispose(): void {
    this.materials.forEach(material => material.dispose());
    this.materials.clear();
  }
}
