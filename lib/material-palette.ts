/**
 * Material Palette
 *
 * Reusable THREE.js materials for building and line rendering.
 * Instead of creating a new material for every object, we maintain
 * a small palette of materials (one per color) and reuse them.
 */

import * as THREE from 'three';

export class MaterialPalette {
  private materials: Map<string, THREE.MeshLambertMaterial> = new Map();
  private lineMaterials: Map<string, THREE.LineBasicMaterial> = new Map();
  private opacity: number;

  constructor(opacity: number = 0.8) {
    this.opacity = opacity;
  }

  /**
   * Get or create a mesh material for a given color (for buildings/3D objects)
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
   * Get or create a line material for a given color (for lines/polylines)
   * Uses LineBasicMaterial which is unlit and always shows the correct color
   */
  getLineMaterial(color: string): THREE.LineBasicMaterial {
    let material = this.lineMaterials.get(color);

    if (!material) {
      material = new THREE.LineBasicMaterial({
        color: color,
        opacity: this.opacity,
        transparent: this.opacity < 1,
        linewidth: 1, // Note: linewidth > 1 only works with WebGLRenderer
      });
      this.lineMaterials.set(color, material);
    }

    return material;
  }

  /**
   * Update opacity for all materials (both mesh and line)
   */
  setOpacity(opacity: number): void {
    this.opacity = opacity;

    // Update mesh materials
    this.materials.forEach(material => {
      material.opacity = opacity;
      material.transparent = opacity < 1;
      material.needsUpdate = true;
    });

    // Update line materials
    this.lineMaterials.forEach(material => {
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
      meshMaterialCount: this.materials.size,
      lineMaterialCount: this.lineMaterials.size,
      totalMaterials: this.materials.size + this.lineMaterials.size,
      meshColors: Array.from(this.materials.keys()),
      lineColors: Array.from(this.lineMaterials.keys()),
    };
  }

  /**
   * Dispose all materials
   */
  dispose(): void {
    this.materials.forEach(material => material.dispose());
    this.materials.clear();

    this.lineMaterials.forEach(material => material.dispose());
    this.lineMaterials.clear();
  }
}
