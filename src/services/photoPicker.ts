import * as ImagePicker from 'expo-image-picker';

export type PhotoSource = 'camera' | 'library';

export class PhotoPermissionError extends Error {
  constructor(message: string, readonly settingsRequired: boolean) {
    super(message);
    this.name = 'PhotoPermissionError';
  }
}

export async function pickSinglePhoto(source: PhotoSource) {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new PhotoPermissionError(
        permission.canAskAgain === false
          ? 'Camera access is disabled. Open Settings to allow camera access.'
          : 'Camera permission is required to take a photo.',
        permission.canAskAgain === false,
      );
    }
  }

  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ allowsEditing: false, mediaTypes: ['images'], quality: 1 })
    : await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, allowsMultipleSelection: false, mediaTypes: ['images'], quality: 1 });
  return result.canceled || result.assets.length === 0 ? null : result.assets[0];
}