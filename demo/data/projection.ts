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

const dmDataRaw = require('./dm_data.json');

console.log('Raw import:', dmDataRaw);
console.log('Type of import:', typeof dmDataRaw);


export interface Data {
  labels: number[];
  labelNames: string[];
  projection: [number, number][];
}

// Transform the imported data to match our interface
// dm_data.json has 'label' instead of 'labels'
const transformedData: Data = {
  labels: dmDataRaw.label,
  labelNames: dmDataRaw.labelNames,
  projection: dmDataRaw.projection.map((point: [number, number, number]) => [point[0], point[1]])
};


export const data: Data = transformedData;
