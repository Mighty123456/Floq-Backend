import { Injectable } from '@nestjs/common';

export interface FilterEffect {
  id: string;
  name: string;
  matrix: number[];
  category: 'classic' | 'vintage' | 'modern';
}

export interface OverlayEffect {
  id: string;
  name: string;
  type: 'icon' | 'image';
  value: string;
  category: 'shapes' | 'textures' | 'art';
}

@Injectable()
export class EffectsService {
  private readonly filters: FilterEffect[] = [
    {
      id: 'normal',
      name: 'Normal',
      category: 'classic',
      matrix: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
    },
    {
      id: 'sepia',
      name: 'Sepia',
      category: 'vintage',
      matrix: [
        0.393, 0.769, 0.189, 0, 0,
        0.349, 0.686, 0.168, 0, 0,
        0.272, 0.534, 0.131, 0, 0,
        0, 0, 0, 1, 0,
      ],
    },
    {
      id: 'mono',
      name: 'Mono',
      category: 'classic',
      matrix: [
        0.2126, 0.7152, 0.0722, 0, 0,
        0.2126, 0.7152, 0.0722, 0, 0,
        0.2126, 0.7152, 0.0722, 0, 0,
        0, 0, 0, 1, 0,
      ],
    },
    {
      id: 'ocean',
      name: 'Ocean',
      category: 'modern',
      matrix: [
        1, 0, 0, 0, 0,
        0, 1.2, 0, 0, 0,
        0, 0, 1.5, 0, 0,
        0, 0, 0, 1, 0,
      ],
    },
    {
      id: 'sunset',
      name: 'Sunset',
      category: 'vintage',
      matrix: [
        1.2, 0, 0, 0, 50,
        0, 1.0, 0, 0, 0,
        0, 0, 0.8, 0, 0,
        0, 0, 0, 1, 0,
      ],
    },
  ];

  private readonly overlays: OverlayEffect[] = [
    { id: 'none', name: 'None', type: 'icon', value: 'block', category: 'shapes' },
    { id: 'heart', name: 'Heart', type: 'icon', value: 'favorite', category: 'shapes' },
    { id: 'star', name: 'Star', type: 'icon', value: 'star', category: 'shapes' },
    { id: 'music', name: 'Vibe', type: 'icon', value: 'music_note', category: 'art' },
  ];

  getFilters() {
    return this.filters;
  }

  getOverlays() {
    return this.overlays;
  }

  getAllEffects() {
    return {
      filters: this.filters,
      overlays: this.overlays,
    };
  }
}
