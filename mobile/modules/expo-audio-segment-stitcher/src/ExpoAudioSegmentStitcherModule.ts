import { NativeModule, requireNativeModule } from 'expo';

declare class ExpoAudioSegmentStitcherModule extends NativeModule<{}> {
  /** Combines segment file URIs (in order) into one .m4a file; returns its URI. */
  concatenateSegments(uris: string[]): Promise<string>;
}

export default requireNativeModule<ExpoAudioSegmentStitcherModule>('ExpoAudioSegmentStitcher');
