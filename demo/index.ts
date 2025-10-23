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

import {data} from './data/projection';
import {Point3D, Dataset, PointMetadata} from '../src/data';
import {makeSequences} from './sequences';
import {ScatterGL, RenderMode} from '../src';
/** SAFEHTML */

const dataPoints: Point3D[] = [];
const metadata: PointMetadata[] = [];
data.projection.forEach((vector, index) => {
  const labelIndex = data.labels[index];
  dataPoints.push(vector);
  metadata.push({
    labelIndex,
    label: data.labelNames[labelIndex],
  });
});

const sequences = makeSequences(dataPoints, metadata);
const dataset = new Dataset(dataPoints, metadata);

// Create filtered dataset without noise (label -1)
const filteredDataPoints: Point3D[] = [];
const filteredMetadata: PointMetadata[] = [];
dataPoints.forEach((point, index) => {
  const labelIndex = metadata[index].labelIndex;
  if (labelIndex !== 0) {
    filteredDataPoints.push(point);
    filteredMetadata.push(metadata[index]);
  }
});
const filteredDataset = new Dataset(filteredDataPoints, filteredMetadata);

dataset.setSpriteMetadata({
  spriteImage: 'sprite.png',
  singleSpriteSize: [50, 50],
  // Uncomment the following line to only use the first sprite for every point
  // spriteIndices: dataPoints.map(d => 0),
});

filteredDataset.setSpriteMetadata({
  spriteImage: 'sprite.png',
  singleSpriteSize: [50, 50],
});

let lastSelectedPoints: number[] = [];
let renderMode = 'points';
let showNoise = true;
let currentDataset = dataset;

const containerElement = document.getElementById('container')!;
const messagesElement = document.getElementById('messages')!;

const setMessage = (message: string) => {
  const messageStr = `🔥 ${message}`;
  console.log(messageStr);
  messagesElement.innerHTML = messageStr;
};

const scatterGL = new ScatterGL(containerElement, {
  onClick: (point: number | null) => {
    setMessage(`click ${point}`);
  },
  onHover: (point: number | null) => {
    setMessage(`hover ${point}`);
  },
  onSelect: (points: number[]) => {
    let message = '';
    if (points.length === 0 && lastSelectedPoints.length === 0) {
      message = 'no selection';
    } else if (points.length === 0 && lastSelectedPoints.length > 0) {
      message = 'deselected';
    } else if (points.length === 1) {
      message = `selected ${points}`;
    } else {
      message = `selected ${points.length} points`;
    }
    setMessage(message);
  },
  renderMode: RenderMode.POINT,
  orbitControls: {
    zoomSpeed: 1.15,
  },
});
scatterGL.render(currentDataset);

// Add in a resize observer for automatic window resize.
window.addEventListener('resize', () => {
  scatterGL.resize();
});

document
  .querySelectorAll<HTMLInputElement>('input[name="interactions"]')
  .forEach(inputElement => {
    inputElement.addEventListener('change', () => {
      if (inputElement.value === 'pan') {
        scatterGL.setPanMode();
      } else if (inputElement.value === 'select') {
        scatterGL.setSelectMode();
      }
    });
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

document
  .querySelectorAll<HTMLInputElement>('input[name="color"]')
  .forEach(inputElement => {
    inputElement.addEventListener('change', () => {
      if (inputElement.value === 'default') {
        scatterGL.setPointColorer(null);
      } else if (inputElement.value === 'label') {
        scatterGL.setPointColorer((i, selectedIndices, hoverIndex) => {
          const labelIndex = currentDataset.metadata![i]['labelIndex'] as number;
          // Use colors from LABEL_PALETTE for all render modes
          return LABEL_PALETTE[labelIndex % LABEL_PALETTE.length];
        });
      }
    });
  });

// Show Noise toggle
const showNoiseToggle = document.querySelector<HTMLInputElement>(
  'input[name="showNoise"]'
)!;
showNoiseToggle.addEventListener('change', () => {
  showNoise = showNoiseToggle.checked;
  currentDataset = showNoise ? dataset : filteredDataset;
  scatterGL.render(currentDataset);

  // Re-apply current render mode
  if (renderMode === 'sprites') {
    scatterGL.setSpriteRenderMode();
  } else {
    scatterGL.setPointRenderMode();
  }

  // Re-apply current coloring if label coloring is active
  const labelColorInput = document.querySelector<HTMLInputElement>('input[name="color"][value="label"]');
  if (labelColorInput && labelColorInput.checked) {
    scatterGL.setPointColorer((i, selectedIndices, hoverIndex) => {
      const labelIndex = currentDataset.metadata![i]['labelIndex'] as number;
      return LABEL_PALETTE[labelIndex % LABEL_PALETTE.length];
    });
  }
});
