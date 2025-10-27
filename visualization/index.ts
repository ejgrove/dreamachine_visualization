/*
@license
Copyright 2019 Google LLC. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

import {data} from './static/projection';
import {Point3D, Dataset, PointMetadata} from '../src/data';
import {makeSequences} from './sequences';
import {ScatterGL, RenderMode} from '../src';
/** SAFEHTML */

const dataPoints: Point3D[] = [];
const metadata: PointMetadata[] = [];
data.projection.forEach((vector, index) => {
  const labelIndex = data.labels[index];
  const labelName = data.labelNames[labelIndex];
  dataPoints.push(vector);
  metadata.push({
    labelIndex,
    label: labelName,
    description: `${labelIndex}: ${labelName}`,
  });
});

const sequences = makeSequences(dataPoints, metadata);
const dataset = new Dataset(dataPoints, metadata);

// Create filtered dataset without noise (label -1)
const filteredDataPoints: Point3D[] = [];
const filteredMetadata: PointMetadata[] = [];
const filteredSpriteIndices: number[] = [];
dataPoints.forEach((point, index) => {
  const labelIndex = metadata[index].labelIndex;
  if (labelIndex !== 0) {
    filteredDataPoints.push(point);
    filteredMetadata.push(metadata[index]);
    filteredSpriteIndices.push(index); // Keep original index for sprite mapping
  }
});
const filteredDataset = new Dataset(filteredDataPoints, filteredMetadata);

dataset.setSpriteMetadata({
  spriteImage: 'sprite.png',
  singleSpriteSize: [50,50],
});

filteredDataset.setSpriteMetadata({
  spriteImage: 'sprite.png',
  singleSpriteSize: [50, 50],
  spriteIndices: filteredSpriteIndices,
});

let lastSelectedPoints: number[] = [];
let renderMode = 'sprites';
let showNoise = true;
let currentDataset = dataset;

const containerElement = document.getElementById('container')!;
const hoverInfoElement = document.getElementById('hover-info')!;
const hoverLabelElement = hoverInfoElement.querySelector('.label')!;
const hoverDescriptionElement = hoverInfoElement.querySelector('.description')!;
const hoverCanvasElement = hoverInfoElement.querySelector('.sprite-image') as HTMLCanvasElement;

// Load the sprite sheet for hover display
const spriteSheet = new Image();
spriteSheet.src = 'sprite.png';

const updateHoverInfo = (pointIndex: number | null) => {
  if (pointIndex === null) {
    hoverInfoElement.classList.add('empty');
    hoverLabelElement.textContent = '';
    hoverDescriptionElement.textContent = '';
  } else {
    const point = currentDataset.metadata![pointIndex];
    const label = point.label || 'Unknown';
    const description = String(point.description || 'No description available');

    hoverInfoElement.classList.remove('empty');
    hoverLabelElement.textContent = String(label);
    hoverDescriptionElement.textContent = description;

    // Draw the sprite on the canvas
    if (spriteSheet.complete) {
      drawSprite(pointIndex);
    } else {
      spriteSheet.onload = () => drawSprite(pointIndex);
    }
  }
};

const drawSprite = (pointIndex: number) => {
  const ctx = hoverCanvasElement.getContext('2d')!;
  const spriteSize = 50; // Original sprite size in the sheet
  const displaySize = 150; // Display size in the canvas

  // Determine which sprite to use
  let spriteIndex = pointIndex;
  if (currentDataset.spriteMetadata?.spriteIndices) {
    spriteIndex = currentDataset.spriteMetadata.spriteIndices[pointIndex];
  }

  // Calculate sprite position in the sprite sheet
  const spritesPerRow = Math.floor(spriteSheet.width / spriteSize);
  const spriteX = (spriteIndex % spritesPerRow) * spriteSize;
  const spriteY = Math.floor(spriteIndex / spritesPerRow) * spriteSize;

  // Clear canvas and draw sprite scaled up to display size
  ctx.clearRect(0, 0, displaySize, displaySize);
  ctx.drawImage(
    spriteSheet,
    spriteX, spriteY, spriteSize, spriteSize,
    0, 0, displaySize, displaySize
  );
};

let selectedPointIndex: number | null = null;
let selectedLabelIndex: number | null = null;

// Function to update button active states
const updateClusterButtons = () => {
  document.querySelectorAll('.cluster-button').forEach(button => {
    const buttonLabelIndex = parseInt(button.getAttribute('data-label-index')!);
    if (selectedLabelIndex === buttonLabelIndex) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });
};

// Function to handle cluster selection
const selectCluster = (labelIndex: number | null) => {
  if (selectedLabelIndex === labelIndex) {
    // Clicking the same cluster - deselect
    selectedLabelIndex = null;
    selectedPointIndex = null;
  } else {
    // Select this cluster
    selectedLabelIndex = labelIndex;
    // Find first point with this label to set selectedPointIndex
    if (labelIndex !== null) {
      for (let i = 0; i < currentDataset.metadata!.length; i++) {
        if (currentDataset.metadata![i]['labelIndex'] === labelIndex) {
          selectedPointIndex = i;
          break;
        }
      }
    } else {
      selectedPointIndex = null;
    }
  }

  updateClusterButtons();

  // Force re-render by re-applying the point colorer if clusters are shown
  const showClustersToggle = document.querySelector<HTMLInputElement>(
    'input[name="showClusters"]'
  )!;

  if (showClustersToggle && showClustersToggle.checked) {
    scatterGL.setPointColorer((i, selectedIndices, hoverIndex) => {
      const labelIndex = currentDataset.metadata![i]['labelIndex'] as number;

      // If a cluster is selected, dim other clusters
      if (selectedLabelIndex !== null) {
        // If it's the same label as the selected cluster, keep normal color
        if (labelIndex === selectedLabelIndex) {
          return LABEL_PALETTE[labelIndex % LABEL_PALETTE.length];
        }

        // Otherwise, return a desaturated, low-opacity grayscale
        return 'rgba(200, 200, 200, 0.3)';
      }

      // No selection - use normal colors from LABEL_PALETTE
      return LABEL_PALETTE[labelIndex % LABEL_PALETTE.length];
    });
  }
};

const scatterGL = new ScatterGL(containerElement, {
  onHover: (point: number | null) => {
    updateHoverInfo(point);
  },
  onClick: (point: number | null) => {
    if (point === null) {
      // Click on empty space - deselect
      selectCluster(null);
    } else {
      // Click on a point - select its cluster
      const labelIndex = currentDataset.metadata![point]['labelIndex'] as number;
      selectCluster(labelIndex);
    }
  },
  renderMode: RenderMode.SPRITE,
  selectEnabled: false,
  showLabelsOnHover: false,
  orbitControls: {
    zoomSpeed: 1.15,
  },
});
scatterGL.render(currentDataset);

// Create cluster buttons
const createClusterButtons = () => {
  const clusterButtonsContainer = document.getElementById('cluster-buttons')!;
  clusterButtonsContainer.innerHTML = '';

  // Get unique label indices
  const uniqueLabels = new Set<number>();
  currentDataset.metadata!.forEach(meta => {
    uniqueLabels.add(meta['labelIndex'] as number);
  });

  // Sort labels
  const sortedLabels = Array.from(uniqueLabels).sort((a, b) => a - b);

  // Create button for each cluster
  sortedLabels.forEach(labelIndex => {
    const labelName = data.labelNames[labelIndex] || 'Unknown';
    const button = document.createElement('button');
    button.className = 'cluster-button';
    button.setAttribute('data-label-index', labelIndex.toString());
    button.innerHTML = `<span class="label-index">${labelIndex}:</span>${labelName}`;

    button.addEventListener('click', () => {
      selectCluster(labelIndex);
    });

    clusterButtonsContainer.appendChild(button);
  });
};

createClusterButtons();

// Add in a resize observer for automatic window resize.
window.addEventListener('resize', () => {
  scatterGL.resize();
});

document
  .querySelectorAll<HTMLInputElement>('input[name="render"]')
  .forEach(inputElement => {
    inputElement.addEventListener('change', () => {
      renderMode = inputElement.value;
      if (inputElement.value === 'points') {
        scatterGL.setPointRenderMode();
      } else if (inputElement.value === 'sprites') {
        scatterGL.setSpriteRenderMode();
        // Re-render the dataset to ensure sprites are displayed
        scatterGL.render(currentDataset);

        // Re-apply cluster coloring if enabled
        const showClustersToggle = document.querySelector<HTMLInputElement>(
          'input[name="showClusters"]'
        )!;
        if (showClustersToggle.checked) {
          scatterGL.setPointColorer((i, selectedIndices, hoverIndex) => {
            const labelIndex = currentDataset.metadata![i]['labelIndex'] as number;

            // If a cluster is selected, dim other clusters
            if (selectedLabelIndex !== null) {
              // If it's the same label as the selected cluster, keep normal color
              if (labelIndex === selectedLabelIndex) {
                return LABEL_PALETTE[labelIndex % LABEL_PALETTE.length];
              }

              // Otherwise, return a desaturated, low-opacity grayscale
              return 'rgba(200, 200, 200, 0.3)';
            }

            // No selection - use normal colors from LABEL_PALETTE
            return LABEL_PALETTE[labelIndex % LABEL_PALETTE.length];
          });
        }
      } else if (inputElement.value === 'text') {
        scatterGL.setTextRenderMode();
      }
    });
  });

  // Label-based palette for the demo (index 0 is gray)
const LABEL_PALETTE: string[] = [
  '#dbdbdb', // label 0
  '#b20014',
  '#8a3dff',
  '#008a00',
  '#eba600',
  '#ff7dd2',
  '#00baf7',
  '#04ff35',
  '#a60082',
  '#0071c6',
  '#ff7561',
  '#db00ff',
  '#00f7be',
  '#8eb61c',
  '#fb0079',
  '#be6100',
];

function colorByLabelIndex(i: number): string {
  const idx = data.labels[i] ?? 0;
  return LABEL_PALETTE[idx % LABEL_PALETTE.length];
}

// Show Clusters toggle
const showClustersToggle = document.querySelector<HTMLInputElement>(
  'input[name="showClusters"]'
)!;

// Initialize with clusters shown (toggle is on by default)
scatterGL.setPointColorer((i, selectedIndices, hoverIndex) => {
  const labelIndex = currentDataset.metadata![i]['labelIndex'] as number;

  // If a cluster is selected, dim other clusters
  if (selectedLabelIndex !== null) {
    // If it's the same label as the selected cluster, keep normal color
    if (labelIndex === selectedLabelIndex) {
      return LABEL_PALETTE[labelIndex % LABEL_PALETTE.length];
    }

    // Otherwise, return a desaturated, low-opacity grayscale
    return 'rgba(200, 200, 200, 0.3)';
  }

  // No selection - use normal colors from LABEL_PALETTE
  return LABEL_PALETTE[labelIndex % LABEL_PALETTE.length];
});

showClustersToggle.addEventListener('change', () => {
  if (showClustersToggle.checked) {
    // Show clusters with label colors
    scatterGL.setPointColorer((i, selectedIndices, hoverIndex) => {
      const labelIndex = currentDataset.metadata![i]['labelIndex'] as number;

      // If a cluster is selected, dim other clusters
      if (selectedLabelIndex !== null) {
        // If it's the same label as the selected cluster, keep normal color
        if (labelIndex === selectedLabelIndex) {
          return LABEL_PALETTE[labelIndex % LABEL_PALETTE.length];
        }

        // Otherwise, return a desaturated, low-opacity grayscale
        return 'rgba(200, 200, 200, 0.3)';
      }

      // No selection - use normal colors from LABEL_PALETTE
      return LABEL_PALETTE[labelIndex % LABEL_PALETTE.length];
    });
  } else {
    // Hide clusters - use default coloring
    scatterGL.setPointColorer(null);
    selectedPointIndex = null; // Reset selection when switching to default
    selectedLabelIndex = null;
    updateClusterButtons();
  }
});

// Show Noise toggle
const showNoiseToggle = document.querySelector<HTMLInputElement>(
  'input[name="showNoise"]'
)!;
showNoiseToggle.addEventListener('change', () => {
  showNoise = showNoiseToggle.checked;
  currentDataset = showNoise ? dataset : filteredDataset;
  scatterGL.render(currentDataset);

  // Recreate cluster buttons for the new dataset
  createClusterButtons();

  // Reset selection
  selectedPointIndex = null;
  selectedLabelIndex = null;
  updateClusterButtons();

  // Re-apply current render mode
  if (renderMode === 'sprites') {
    scatterGL.setSpriteRenderMode();
  } else {
    scatterGL.setPointRenderMode();
  }

  // Re-apply current coloring if cluster coloring is active
  if (showClustersToggle.checked) {
    scatterGL.setPointColorer((i, selectedIndices, hoverIndex) => {
      const labelIndex = currentDataset.metadata![i]['labelIndex'] as number;

      // If a cluster is selected, dim other clusters
      if (selectedLabelIndex !== null) {
        // If it's the same label as the selected cluster, keep normal color
        if (labelIndex === selectedLabelIndex) {
          return LABEL_PALETTE[labelIndex % LABEL_PALETTE.length];
        }

        // Otherwise, return a desaturated, low-opacity grayscale
        return 'rgba(200, 200, 200, 0.3)';
      }

      // No selection - use normal colors from LABEL_PALETTE
      return LABEL_PALETTE[labelIndex % LABEL_PALETTE.length];
    });
  }
});
