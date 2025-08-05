import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import * as pb from 'acine-proto-dist';

import Button from './ui/Button';
import ConditionOverlay from './ConditionOverlay';
import Modal from './ui/Modal';
import NumberInput from './ui/NumberInput';
import RegionEditor from './ui/RegionEditor';
import Select from './ui/Select';

import { $frames, $routine, $sourceDimensions } from '@/state';
import { $condition } from './ConditionImageEditor.state';
import { runtimeConditionQuery } from '../App.state';
import useForceUpdate from './useForceUpdate';

/**
 * Appears as a modal.
 */
export default function ConditionImageEditor() {
  const routine = useStore($routine);
  const frames = useStore($frames);
  const [width, height] = useStore($sourceDimensions);
  const condition = useStore($condition);
  const forceUpdate = useForceUpdate();

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

      // initialize to reasonable defaults
      let changed = false;
      if (!condition.threshold) {
        condition.threshold = 0.99;
        changed = true;
      }
      if (!condition.matchLimit) {
        condition.matchLimit = 3;
        changed = true;
      }
      if (changed) forceUpdate();
    }
  }, [condition, forceUpdate, frames, routine.frames]);

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
  }, [src, open, frames, condition, routine.frames]);

  // auto select
  // Can migrate to direct useRef (or similar) in React 19
  // but currently many dependencies don't support it yet (as of 4/23/2025).
  // const selectRef = useRef<HTMLSelectElement>(null);
  // useEffect(() => {
  //   if (open && selectRef.current) {
  //     selectRef.current.focus();
  //   }
  // }, [open]);

  const [preview, setPreview] = useState<
    Awaited<ReturnType<typeof runtimeConditionQuery>>
  >([]);

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
          <div className='flex items-center gap-4'>
            <Button
              className='hover:bg-amber-100'
              onClick={async () => {
                const c = pb.Routine_Condition.create({
                  condition: { $case: 'image', image: condition },
                });
                setPreview(await runtimeConditionQuery(c));
              }}
            >
              Query
            </Button>
            <NumberInput
              object={condition}
              property='threshold'
              callback={forceUpdate}
            />
            <NumberInput
              object={condition}
              property='matchLimit'
              callback={forceUpdate}
            />
            <NumberInput
              object={condition}
              property='padding'
              callback={forceUpdate}
            />
          </div>
          <div className='flex'>
            <div className='flex justify-center w-full'>
              <RegionEditor
                composite
                regions={condition.regions}
                width={width}
                height={height}
                onChange={(r) => {
                  condition.regions = r;
                  $routine.set(routine);
                }}
              >
                <img
                  className='max-h-full pointer-events-none select-none'
                  src={src}
                  draggable={false}
                />
              </RegionEditor>
            </div>
            <div className='flex justify-center w-full'>
              <RegionEditor
                composite
                regions={condition.allowRegions}
                width={width}
                height={height}
                onChange={(r) => {
                  condition.allowRegions = r;
                  $routine.set(routine);
                }}
              >
                <img
                  className='pointer-events-none select-none opacity-0'
                  src={src}
                  draggable={false}
                />
                {preview.map((p, index) => (
                  <img
                    key={index}
                    className='pointer-events-none select-none absolute left-0 top-0'
                    style={{ opacity: 1 / (index + 1) }}
                    src={
                      p.frame?.id &&
                      frames[
                        routine.frames.map((f) => f.id).indexOf(p.frame?.id)
                      ]
                    }
                    draggable={false}
                  />
                ))}
                <ConditionOverlay
                  preview={preview}
                  templateRegions={condition.regions}
                  threshold={condition.threshold}
                  width={width}
                  height={height}
                />
              </RegionEditor>
            </div>
          </div>
        </div>
      </Modal>
    )
  );
}
