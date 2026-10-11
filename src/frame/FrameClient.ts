/**
 * The seam between the app and the TV. Everything above this interface
 * (library, collections, rules, scheduler) is ours; everything below it is
 * Samsung's undocumented protocol.
 */

export interface DeviceInfo {
  model: string | undefined;
  name: string | undefined;
  frameTvSupport: boolean;
  powerOn: boolean;
  raw: Record<string, unknown>;
}

export interface ArtItem {
  contentId: string;
  categoryId: string;
  /** Everything else the TV reports (dimensions, matte, image_date, ...). */
  raw: Record<string, unknown>;
}

export interface UploadOptions {
  fileType?: 'jpg' | 'png';
  /** e.g. "none", "shadowbox_polar", "modern_apricot". Not every matte fits every aspect ratio. */
  matte?: string;
  portraitMatte?: string;
}

/** TV-side categories. MY-C0002 is "My Photos" (uploads), MY-C0004 favourites, MY-C0008 store. */
export const Category = {
  MyPhotos: 'MY-C0002',
  Favourites: 'MY-C0004',
  Store: 'MY-C0008',
} as const;

export interface FrameClient {
  /** REST device info. Works even when the art channel is unhappy. */
  deviceInfo(): Promise<DeviceInfo>;
  apiVersion(): Promise<string>;

  list(category?: string): Promise<ArtItem[]>;
  current(): Promise<Record<string, unknown>>;

  /** Returns the TV-assigned content id (MY-Fxxxx). */
  upload(image: Buffer, opts?: UploadOptions): Promise<string>;
  select(contentId: string, opts?: { show?: boolean; category?: string }): Promise<void>;
  delete(contentIds: string | string[]): Promise<void>;
  changeMatte(contentId: string, matte: string, portraitMatte?: string): Promise<void>;

  getArtMode(): Promise<boolean>;
  setArtMode(on: boolean): Promise<void>;

  close(): Promise<void>;
}
