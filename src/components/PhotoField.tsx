import { Camera } from 'lucide-react';
import { shrinkPhoto } from '../lib/files';

interface PhotoFieldProps {
  photo: string | undefined;
  onChange: (photo: string | null) => void;
  onError: (message: string) => void;
}

/** Validates and shrinks an image file, reporting problems through `onError`. */
export async function readPhoto(
  file: File,
  onChange: (photo: string) => void,
  onError: (message: string) => void,
) {
  // Some systems report no type for valid images, so only reject a known non-image type.
  if (file.type && !file.type.startsWith('image/')) return onError('That file isn’t an image.');
  try {
    onChange(await shrinkPhoto(file));
  } catch {
    onError('That photo couldn’t be read. Try a different one.');
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
            accept="image/*"
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
