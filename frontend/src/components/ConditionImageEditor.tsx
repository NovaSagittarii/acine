import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';

import Modal from './ui/Modal';
import Select from './ui/Select';
import { $frames, $routine, $sourceDimensions } from '@/state';
import RegionEditor from './ui/RegionEditor';

import { $condition } from './ConditionImageEditor.state';

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
      const { frameId } = condition;
      if (frameId) {
        setSrc(frames[routine.frames.map((f) => f.id).indexOf(frameId)]);
        // console.log("with condition, call set src", condition);
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
    if (!open) return;
    const i = frames.indexOf(src);
    // console.log('sync image', src, 'idx=', i);
    if (condition) condition.frameId = routine.frames[i].id;
  }, [src, open]);

  // auto select
  // Can migrate to direct useRef (or similar) in React 19
  // but currently many dependencies don't support it yet (as of 4/23/2025).
  // const selectRef = useRef<HTMLSelectElement>(null);
  // useEffect(() => {
  //   if (open && selectRef.current) {
  //     selectRef.current.focus();
  //   }
  // }, [open]);

  return (
    condition && (
      <Modal isOpen={open} onClose={() => close()}>
        <div className='flex flex-col m-12 grow bg-white pointer-events-auto'>
          <Select
            value={frames.indexOf(src)}
            values={imageChoices}
            onChange={(s) => setSrc(frames[s])}
            autofocus
          />
          <div className='flex justify-center w-full'>
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
        </div>
      </Modal>
    )
  );
}
