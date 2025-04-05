import { atom } from 'nanostores';
import { ReactNode, useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { Routine_Condition_Image } from 'acine-proto-dist';

import Modal from './ui/Modal';
import Select from './ui/Select';
import { $frames, $routine, $sourceDimensions } from '@/state';
import RegionEditor from './ui/RegionEditor';

export const $condition = atom<null | Routine_Condition_Image>(null);

/**
 * Appears as a modal.
 */
export default function ConditionImageEditor() {
  const routine = useStore($routine);
  const frames = useStore($frames);
  const [width, height] = useStore($sourceDimensions);
  const condition = useStore($condition);

  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
    $condition.set(null);
  };

  const [src, setSrc] = useState<string>('');
  useEffect(() => {
    if (condition !== null) {
      setOpen(true);
      if (condition.frameId) {
        setSrc(
          frames[routine.frames.map((f) => f.id).indexOf(condition.frameId)],
        );
      }
    }
  }, [condition]);

  const [imageChoices, setImageChoices] = useState<[string, number][]>([]);
  useEffect(() => {
    const images = frames.map((_, i) => [frames[i], i] as [string, number]);
    setImageChoices(images);
    if (images.length) setSrc((s) => (s ? s : images[0][0]));
  }, [frames]);

  // sync condition image
  useEffect(() => {
    const i = frames.indexOf(src);
    console.log(src, 'idx=', i);
    if (condition) condition.frameId = routine.frames[i].id;
  }, [src]);

  return (
    condition && (
      <Modal isOpen={open} onClose={() => close()}>
        <div className='m-12 grow bg-white pointer-events-auto'>
          <Select
            values={imageChoices}
            // defaultIndex={imageChoices.map((s) => s[0]).indexOf(condition.frameId)}
            onChange={(s) => setSrc(frames[s])}
          />
          <RegionEditor
            composite
            regions={condition.regions}
            width={width}
            height={height}
            onChange={(r) => {
              condition.regions = r;
              $routine.set(routine);
              console.log(routine);
            }}
          >
            <img
              className='max-h-full pointer-events-none select-none'
              src={src}
              draggable={false}
            />
          </RegionEditor>
        </div>
      </Modal>
    )
  );
}
