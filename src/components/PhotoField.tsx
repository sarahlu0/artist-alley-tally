import { Camera } from 'lucide-react';
import { shrinkPhoto } from '../lib/files';
import { isPsd, PsdError } from '../lib/psd';

interface PhotoFieldProps {
  photo: string | undefined;
  onChange: (photo: string | null) => void;
  onError: (message: string) => void;
}

/** Validates and shrinks an image or PSD file, reporting problems through `onError`. */
export async function readPhoto(
  file: File,
  onChange: (photo: string) => void,
  onError: (message: string) => void,
) {
  // Some systems report no type, or a generic one, for valid images and PSDs.
  const knownNonImage = file.type && !file.type.startsWith('image/');
  if (knownNonImage && !(await isPsd(file))) return onError('That file isn’t an image.');
  try {
    onChange(await shrinkPhoto(file));
  } catch (error) {
    onError(
      error instanceof PsdError
        ? error.message
        : 'That photo couldn’t be read. Try a different one.',
    );
  }
}

export function PhotoField({ photo, onChange, onError }: PhotoFieldProps) {
  return (
    <div className="row photo-row">
      <div className="photo-preview">
        {photo ? <img src={photo} alt="" /> : <Camera size={26} aria-hidden="true" />}
      </div>
      <div className="stack tight">
        <label className="button small file-button">
          {photo ? 'Change photo' : 'Add photo'}
          <input
            type="file"
            accept="image/*,.psd"
            className="visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) readPhoto(file, onChange, onError);
              // Lets the same file be picked again after removing it.
              event.target.value = '';
            }}
          />
        </label>
        <span className="small muted drop-hint">or drop an image here</span>
        {photo && (
          <button type="button" className="link small" onClick={() => onChange(null)}>
            Remove photo
          </button>
        )}
      </div>
    </div>
  );
}
