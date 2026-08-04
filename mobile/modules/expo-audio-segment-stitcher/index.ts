// Re-export the native module. On web, it will be resolved to ExpoAudioSegmentStitcherModule.web.ts
// and on native platforms to ExpoAudioSegmentStitcherModule.ts
export { default } from './src/ExpoAudioSegmentStitcherModule';
export * from './src/ExpoAudioSegmentStitcher.types';
