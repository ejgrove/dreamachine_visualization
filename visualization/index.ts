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

// Loading bar functionality
const loadingOverlay = document.getElementById('loading-overlay')!;
const loadingBar = document.getElementById('loading-bar')!;
const loadingText = document.getElementById('loading-text')!;
const assetLoadingIndicator = document.getElementById('asset-loading-indicator')!;
const spriteSheet = new Image();
spriteSheet.decoding = 'async';
spriteSheet.src = 'sprite.png';

function updateLoadingProgress(progress: number) {
  loadingBar.style.width = `${progress}%`;
}

function updateLoadingMessage(message: string) {
  loadingText.textContent = message;
}

function hideLoadingScreen() {
  loadingOverlay.classList.add('hidden');
  setTimeout(() => {
    loadingOverlay.style.display = 'none';
  }, 300); // Wait for fade out transition
}

function hideAssetLoadingIndicator() {
  assetLoadingIndicator.classList.add('hidden');
}

// Simulate loading progress
updateLoadingProgress(30); // Initial data loaded

const dataPoints: Point3D[] = [];
const metadata: PointMetadata[] = [];
data.projection.forEach((vector, index) => {
  const labelIndex = data.labels[index];
  const labelName = data.labelNames[labelIndex];
  const category = data.categories[labelIndex];
  const quantity = data.quantities[labelIndex];
  dataPoints.push(vector);
  metadata.push({
    labelIndex,
    label: labelName,
    description: `${labelIndex}: ${labelName}`,
    category,
    quantity,
  });
});

const sequences = makeSequences(dataPoints, metadata);
const dataset = new Dataset(dataPoints, metadata);

updateLoadingProgress(50); // Dataset created

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

updateLoadingProgress(60); // Filtered dataset created

dataset.setSpriteMetadata({
  spriteImage: spriteSheet,
  singleSpriteSize: [50,50],
});

filteredDataset.setSpriteMetadata({
  spriteImage: spriteSheet,
  singleSpriteSize: [50, 50],
  spriteIndices: filteredSpriteIndices,
});

updateLoadingMessage('Loading drawings...');
updateLoadingProgress(70); // Sprite metadata configured

let lastSelectedPoints: number[] = [];
let renderMode = 'sprites';
let showNoise = true;
let currentDataset = dataset;

const containerElement = document.getElementById('container')!;
const controlsElement = document.getElementById('controls')!;
const controlsToggleElement = document.getElementById('controls-toggle') as HTMLButtonElement;
const controlsCloseElement = document.getElementById('controls-close') as HTMLButtonElement;
const aboutToggleElement = document.getElementById('about-trigger') as HTMLButtonElement;
const aboutPanelElement = document.getElementById('about-panel')!;
const aboutCloseElement = document.getElementById('about-close') as HTMLButtonElement;
const clusterTriggerElement = document.getElementById('cluster-trigger') as HTMLButtonElement;
const clusterPanelElement = document.getElementById('cluster-panel')!;
const clusterCloseElement = document.getElementById('cluster-close') as HTMLButtonElement;
const hoverCardElement = document.getElementById('hover-card')!;
const hoverLabelElement = hoverCardElement.querySelector('.label')!;
const hoverDescriptionElement = hoverCardElement.querySelector('.description')!;
const hoverCanvasElement = hoverCardElement.querySelector('.sprite-image') as HTMLCanvasElement;
const SMALL_SPRITE_SIZE = 50;
const SMALL_DISPLAY_SIZE = 140;
const HOVER_CARD_OFFSET = 20;
const PANEL_STACK_GAP = 10;
const CLUSTER_COMPACT_BREAKPOINT = 1100;
const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
const prefersCoarsePointer = () => coarsePointerQuery.matches;
const isCompactClusterLayout = () => window.innerWidth <= CLUSTER_COMPACT_BREAKPOINT;
let previousCompactClusterLayout = isCompactClusterLayout();

let hoveredPointIndex: number | null = null;
let hoverPointerX = window.innerWidth / 2;
let hoverPointerY = window.innerHeight / 2;

const getSpriteIndex = (pointIndex: number) => {
  if (currentDataset.spriteMetadata?.spriteIndices) {
    return currentDataset.spriteMetadata.spriteIndices[pointIndex];
  }
  return pointIndex;
};

const positionHoverCard = () => {
  if (!hoverCardElement.classList.contains('visible')) {
    return;
  }

  if (prefersCoarsePointer()) {
    const x = Math.max(12, (window.innerWidth - hoverCardElement.offsetWidth) / 2);
    const y = Math.max(
      12,
      window.innerHeight - hoverCardElement.offsetHeight - 12 - Math.min(window.innerHeight * 0.46, 280)
    );
    hoverCardElement.style.left = `${x}px`;
    hoverCardElement.style.top = `${y}px`;
    return;
  }

  const maxLeft = window.innerWidth - hoverCardElement.offsetWidth - 12;
  const maxTop = window.innerHeight - hoverCardElement.offsetHeight - 12;
  const x = Math.min(Math.max(12, hoverPointerX + HOVER_CARD_OFFSET), maxLeft);
  const y = Math.min(Math.max(12, hoverPointerY + HOVER_CARD_OFFSET), maxTop);

  hoverCardElement.style.left = `${x}px`;
  hoverCardElement.style.top = `${y}px`;
};

const showHoverCard = () => {
  hoverCardElement.classList.add('visible');
  hoverCardElement.setAttribute('aria-hidden', 'false');
  positionHoverCard();
};

const hideHoverCard = () => {
  hoverCardElement.classList.remove('visible');
  hoverCardElement.setAttribute('aria-hidden', 'true');
};

const updateHoverInfo = (pointIndex: number | null) => {
  hoveredPointIndex = pointIndex;

  if (pointIndex === null) {
    hideHoverCard();
    hoverLabelElement.textContent = '';
    hoverDescriptionElement.textContent = '';
    const ctx = hoverCanvasElement.getContext('2d')!;
    ctx.clearRect(0, 0, hoverCanvasElement.width, hoverCanvasElement.height);
  } else {
    const point = currentDataset.metadata![pointIndex];
    const label = point.label || 'Unknown';
    const rawQuantity = (point as any).quantity || 'N/A';
    const quantity = rawQuantity !== 'N/A' ? parseInt(rawQuantity) : 'N/A';
    const description = `N=${quantity}`;

    hoverLabelElement.textContent = String(label);
    hoverDescriptionElement.textContent = description;
    showHoverCard();

    if (spriteSheet.complete && spriteSheet.naturalWidth > 0) {
      drawSprite(pointIndex, spriteSheet, SMALL_SPRITE_SIZE, SMALL_DISPLAY_SIZE);
    } else {
      spriteSheet.addEventListener(
        'load',
        () => {
          if (hoveredPointIndex === pointIndex) {
            drawSprite(pointIndex, spriteSheet, SMALL_SPRITE_SIZE, SMALL_DISPLAY_SIZE);
          }
        },
        {once: true}
      );
    }
  }
};

const drawSprite = (
  pointIndex: number,
  activeSpriteSheet: HTMLImageElement,
  spriteSize: number,
  displaySize: number
) => {
  const ctx = hoverCanvasElement.getContext('2d')!;
  hoverCanvasElement.width = displaySize;
  hoverCanvasElement.height = displaySize;
  ctx.imageSmoothingEnabled = true;

  const spriteIndex = getSpriteIndex(pointIndex);
  const spritesPerRow = Math.floor(activeSpriteSheet.width / spriteSize);
  const spriteX = (spriteIndex % spritesPerRow) * spriteSize;
  const spriteY = Math.floor(spriteIndex / spritesPerRow) * spriteSize;

  ctx.clearRect(0, 0, displaySize, displaySize);
  ctx.drawImage(
    activeSpriteSheet,
    spriteX, spriteY, spriteSize, spriteSize,
    0, 0, displaySize, displaySize
  );
  positionHoverCard();
};

const syncPanelLayout = () => {
  const controlsOpen = controlsElement.classList.contains('open');
  aboutPanelElement.classList.toggle('shifted', controlsOpen);

  const controlsLeft = window.innerWidth <= 768 ? 14 : 18;
  const controlsTop = window.innerWidth <= 768 ? 62 : 70;
  const aboutTop = window.innerWidth <= 768 ? 62 : 70;
  controlsElement.style.top = `${controlsTop}px`;
  controlsElement.style.left = `${controlsLeft}px`;
  aboutPanelElement.style.left = `${controlsLeft}px`;

  if (controlsOpen) {
    const controlsRect = controlsElement.getBoundingClientRect();
    aboutPanelElement.style.top = `${controlsRect.bottom + PANEL_STACK_GAP}px`;
  } else {
    aboutPanelElement.style.top = `${aboutTop}px`;
  }
};

const setControlsOpen = (isOpen: boolean) => {
  controlsElement.classList.toggle('open', isOpen);
  controlsElement.setAttribute('aria-hidden', String(!isOpen));
  controlsToggleElement.setAttribute('aria-expanded', String(isOpen));
  syncPanelLayout();
};

const setAboutOpen = (isOpen: boolean) => {
  aboutPanelElement.classList.toggle('open', isOpen);
  aboutToggleElement.setAttribute('aria-expanded', String(isOpen));
  syncPanelLayout();
};

const setClusterPanelOpen = (isOpen: boolean) => {
  const clustersEnabled =
    document.querySelector<HTMLInputElement>('input[name="showClusters"]')?.checked ?? true;
  const shouldOpen = clustersEnabled && isOpen;
  clusterPanelElement.classList.toggle('open', shouldOpen);
  clusterPanelElement.setAttribute('aria-hidden', String(!shouldOpen));
  clusterTriggerElement.classList.toggle('hidden', !clustersEnabled || shouldOpen);
  clusterTriggerElement.setAttribute('aria-expanded', String(shouldOpen));
};

controlsToggleElement.addEventListener('click', () => {
  setControlsOpen(!controlsElement.classList.contains('open'));
});

controlsCloseElement.addEventListener('click', () => {
  setControlsOpen(false);
});

aboutToggleElement.addEventListener('click', () => {
  setAboutOpen(!aboutPanelElement.classList.contains('open'));
});

aboutCloseElement.addEventListener('click', () => {
  setAboutOpen(false);
});

clusterTriggerElement.addEventListener('click', () => {
  setClusterPanelOpen(!clusterPanelElement.classList.contains('open'));
});

clusterCloseElement.addEventListener('click', () => {
  setClusterPanelOpen(false);
});

syncPanelLayout();

containerElement.addEventListener('pointermove', event => {
  hoverPointerX = event.clientX;
  hoverPointerY = event.clientY;
  positionHoverCard();
});

window.addEventListener('resize', () => {
  positionHoverCard();
});

let selectedPointIndex: number | null = null;
let selectedLabelIndex: number | null = null;
let hoveredLabelIndex: number | null = null; // Track hovered cluster from buttons
let sidebarHoveredLabelIndex: number | null = null; // Track hovered cluster from plot hover
let hoverTimeoutId: number | null = null; // Track timeout for delayed hover clear

// Function to update button active states
const updateClusterButtons = () => {
  document.querySelectorAll('.cluster-button').forEach(button => {
    const buttonLabelIndex = parseInt(button.getAttribute('data-label-index')!);
    if (selectedLabelIndex === buttonLabelIndex) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }

    if (
      selectedLabelIndex !== buttonLabelIndex &&
      sidebarHoveredLabelIndex === buttonLabelIndex
    ) {
      button.classList.add('hovered');
    } else {
      button.classList.remove('hovered');
    }
  });
};

// Function to handle cluster hover (temporary highlight without selection)
const hoverCluster = (labelIndex: number | null, immediate: boolean = false) => {
  // Clear any pending timeout
  if (hoverTimeoutId !== null) {
    clearTimeout(hoverTimeoutId);
    hoverTimeoutId = null;
  }

  // If clearing hover and not immediate, delay it
  if (labelIndex === null && !immediate) {
    hoverTimeoutId = window.setTimeout(() => {
      hoverTimeoutId = null;
      applyHoverCluster(null);
    }, 200); // 0.3 second delay
    return;
  }

  // Apply immediately
  applyHoverCluster(labelIndex);
};

// Function that actually applies the hover cluster highlighting
const applyHoverCluster = (labelIndex: number | null) => {
  hoveredLabelIndex = labelIndex;

  // Apply the same highlighting as selection, but don't change selectedLabelIndex
  if (labelIndex !== null) {
    // Collect all points with this label
    const clusterPointIndices: number[] = [];
    for (let i = 0; i < currentDataset.metadata!.length; i++) {
      if (currentDataset.metadata![i]['labelIndex'] === labelIndex) {
        clusterPointIndices.push(i);
      }
    }
    // Bring all points in this cluster to the front
    scatterGL.highlightPoints(clusterPointIndices);
  } else {
    // Clear hover - restore to selected state or clear
    if (selectedLabelIndex !== null) {
      // Restore selection highlight
      const clusterPointIndices: number[] = [];
      for (let i = 0; i < currentDataset.metadata!.length; i++) {
        if (currentDataset.metadata![i]['labelIndex'] === selectedLabelIndex) {
          clusterPointIndices.push(i);
        }
      }
      scatterGL.highlightPoints(clusterPointIndices);
    } else {
      scatterGL.highlightPoints([]);
    }
  }

  // Force re-render with updated coloring
  const showClustersToggle = document.querySelector<HTMLInputElement>(
    'input[name="showClusters"]'
  )!;

  if (showClustersToggle && showClustersToggle.checked) {
    scatterGL.setPointColorer((i, selectedIndices, hoverIndex) => {
      const labelIndex = currentDataset.metadata![i]['labelIndex'] as number;

      // Use hovered cluster if hovering, otherwise use selected cluster
      const activeCluster = hoveredLabelIndex !== null ? hoveredLabelIndex : selectedLabelIndex;

      // If a cluster is active (hovered or selected), dim other clusters
      if (activeCluster !== null) {
        // If it's the same label as the active cluster, keep normal color
        if (labelIndex === activeCluster) {
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

// Function to handle cluster selection
const selectCluster = (labelIndex: number | null) => {
  // Clear any pending hover timeout
  if (hoverTimeoutId !== null) {
    clearTimeout(hoverTimeoutId);
    hoverTimeoutId = null;
  }

  if (selectedLabelIndex === labelIndex) {
    // Clicking the same cluster - deselect
    selectedLabelIndex = null;
    selectedPointIndex = null;
    hoveredLabelIndex = null; // Clear hover when deselecting
  } else {
    // Select this cluster
    selectedLabelIndex = labelIndex;
    hoveredLabelIndex = null; // Clear hover when selecting
    // Find first point with this label to set selectedPointIndex
    if (labelIndex !== null) {
      // Collect all points with this label
      const clusterPointIndices: number[] = [];
      for (let i = 0; i < currentDataset.metadata!.length; i++) {
        if (currentDataset.metadata![i]['labelIndex'] === labelIndex) {
          if (clusterPointIndices.length === 0) {
            selectedPointIndex = i; // Set first point as selected
          }
          clusterPointIndices.push(i);
        }
      }
      // Bring all points in this cluster to the front
      scatterGL.highlightPoints(clusterPointIndices);
    } else {
      selectedPointIndex = null;
    }
  }

  // If deselecting, clear highlight
  if (selectedLabelIndex === null) {
    scatterGL.highlightPoints([]);
  }

  updateClusterButtons();

  // Force re-render by re-applying the point colorer if clusters are shown
  const showClustersToggle = document.querySelector<HTMLInputElement>(
    'input[name="showClusters"]'
  )!;

  if (showClustersToggle && showClustersToggle.checked) {
    scatterGL.setPointColorer((i, selectedIndices, hoverIndex) => {
      const labelIndex = currentDataset.metadata![i]['labelIndex'] as number;

      // Use hovered cluster if hovering, otherwise use selected cluster
      const activeCluster = hoveredLabelIndex !== null ? hoveredLabelIndex : selectedLabelIndex;

      // If a cluster is active (hovered or selected), dim other clusters
      if (activeCluster !== null) {
        // If it's the same label as the active cluster, keep normal color
        if (labelIndex === activeCluster) {
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

const scatterGL = new ScatterGL(containerElement, {
  onHover: (point: number | null) => {
    if (prefersCoarsePointer()) {
      return;
    }

    updateHoverInfo(point);
    sidebarHoveredLabelIndex =
      point === null ? null : (currentDataset.metadata![point]['labelIndex'] as number);
    updateClusterButtons();
  },
  onClick: (point: number | null) => {
    if (prefersCoarsePointer()) {
      updateHoverInfo(point);
      sidebarHoveredLabelIndex =
        point === null ? null : (currentDataset.metadata![point]['labelIndex'] as number);
      updateClusterButtons();
    }

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

updateLoadingProgress(80); // ScatterGL initialized

scatterGL.render(currentDataset);

updateLoadingProgress(90); // Initial render complete

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
    const labelColor = LABEL_PALETTE[labelIndex % LABEL_PALETTE.length];

    const button = document.createElement('button');
    button.className = 'cluster-button';
    button.setAttribute('data-label-index', labelIndex.toString());
    button.innerHTML = `<span class="label-index">${labelIndex}:</span>${labelName}`;
    button.style.borderColor = labelColor;
    button.style.borderWidth = '3px';

    button.addEventListener('click', () => {
      selectCluster(labelIndex);
    });

    if (!prefersCoarsePointer()) {
      // Add hover listeners for temporary highlighting on desktop pointers only.
      button.addEventListener('mouseenter', () => {
        if (selectedLabelIndex !== labelIndex) {
          hoverCluster(labelIndex);
        }
      });

      button.addEventListener('mouseleave', () => {
        if (selectedLabelIndex !== labelIndex) {
          hoverCluster(null);
        }
      });
    }

    clusterButtonsContainer.appendChild(button);
  });
};

createClusterButtons();

updateLoadingProgress(95); // UI initialized

updateLoadingProgress(100);
hideLoadingScreen();

if (spriteSheet.complete && spriteSheet.naturalWidth > 0) {
  hideAssetLoadingIndicator();
} else {
  spriteSheet.addEventListener(
    'load',
    () => {
      hideAssetLoadingIndicator();
    },
    {once: true}
  );
  spriteSheet.addEventListener('error', hideAssetLoadingIndicator, {once: true});
}

// Add in a resize observer for automatic window resize.
window.addEventListener('resize', () => {
  const compactClusterLayout = isCompactClusterLayout();
  if (compactClusterLayout && !previousCompactClusterLayout) {
    setClusterPanelOpen(false);
  }
  previousCompactClusterLayout = compactClusterLayout;
  scatterGL.resize();
  syncPanelLayout();
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

function colorByLabelIndex(i: number): string {
  const idx = data.labels[i] ?? 0;
  return LABEL_PALETTE[idx % LABEL_PALETTE.length];
}

// Show Clusters toggle
const showClustersToggle = document.querySelector<HTMLInputElement>(
  'input[name="showClusters"]'
)!;

setClusterPanelOpen(showClustersToggle.checked && !isCompactClusterLayout());

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
    setClusterPanelOpen(!isCompactClusterLayout());

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
    setClusterPanelOpen(false);

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
  hoveredPointIndex = null;
  hideHoverCard();
  scatterGL.render(currentDataset);

  // Recreate cluster buttons for the new dataset
  createClusterButtons();

  // Reset selection
  selectedPointIndex = null;
  selectedLabelIndex = null;
  sidebarHoveredLabelIndex = null;
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
