/**
 * LayerBadge.tsx — which page of the world this is and what it is bound to
 * (prototype #layerBadge, L522). Display only.
 */
import React from 'react';

export interface LayerBadgeProps {
  /** Display name of the current layer. */
  name: string;
  /** Material the layer is bound to; rendered as `material: <value>`. */
  material: string;
}

export const LayerBadge: React.FC<LayerBadgeProps> = ({ name, material }) => (
  <div className="layer-badge">
    <div className="layer-badge__name">{name}</div>
    <div className="layer-badge__mat">{`material: ${material}`}</div>
  </div>
);
