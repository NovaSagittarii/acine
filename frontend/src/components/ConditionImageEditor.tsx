import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import * as pb from 'acine-proto-dist';
import { Routine_Condition_Image_Method as Method } from 'acine-proto-dist';

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

const METHOD_TYPES_DISPLAY = [
  ['unset (ccorr)', Method.METHOD_UNSPECIFIED],
  ['ccoeff (mask not supported)', Method.METHOD_TM_CCOEFF_NORMED],
  ['ccorr', Method.METHOD_TM_CCORR_NORMED],
  ['sqdiff', Method.METHOD_TM_SQDIFF_NORMED],
] as [string, Method][];

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
      if (!frameId) {
        // use previous one
        const i = frames.indexOf(src);
        if (i >= 0 && condition) {
          condition.frameId = routine.frames[i].id;
          changed = true;
        }
      }
      if (changed) forceUpdate();
    }
  }, [condition, forceUpdate, frames, routine.frames, src]);

  const [imageChoices, setImageChoices] = useState<[string, number][]>([]);
  useEffect(() => {
    const images = frames.map((_, i) => [frames[i], i] as [string, number]);
    setImageChoices(images);
    if (images.length) setSrc((s) => (s ? s : images[0][0]));
  }, [frames]);

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

  const refreshPreview = () => {
    if (condition) {
      const c = pb.Routine_Condition.create({
        condition: { $case: 'image', image: condition },
      });
      runtimeConditionQuery(c)
        .then((w) => setPreview(w))
        .catch((e) => console.error('Failed condition query.', e));
    }
  };

  return (
    condition && (
      <Modal isOpen={open} onClose={() => close()}>
        <div className='flex flex-col m-12 grow bg-white pointer-events-auto'>
          <Select
            value={frames.indexOf(src)}
            values={imageChoices}
            onChange={(s) => {
              condition.frameId = routine.frames[s].id;
              refreshPreview();
            }}
            autofocus
          />
          <div className='flex items-center gap-6'>
            <Button className='hover:bg-amber-100' onClick={refreshPreview}>
              Query
            </Button>
            <Select
              value={condition.method}
              values={METHOD_TYPES_DISPLAY}
              onChange={(t) => {
                condition.method = t;
                refreshPreview();
              }}
            />
            <NumberInput
              object={condition}
              property='threshold'
              callback={refreshPreview}
            />
            <NumberInput
              object={condition}
              property='matchLimit'
              callback={refreshPreview}
            />
            <NumberInput
              object={condition}
              property='padding'
              callback={refreshPreview}
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
                  refreshPreview();
                }}
              >
                <img
                  className='max-h-full select-none'
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
                  refreshPreview();
                }}
              >
                <img
                  className='select-none opacity-0'
                  src={src}
                  draggable={false}
                />
                {preview.map((p, index) => (
                  <img
                    key={index}
                    className='select-none absolute left-0 top-0'
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
                  debug
                />
              </RegionEditor>
            </div>
          </div>
          <div className='grid grid-cols-8 overflow-y-auto h-full'>
            {preview.map((x, index) => (
              <div key={index} className='h-fit w-fit relative'>
                <img
                  className='select-none w-full'
                  src={
                    x.frame?.id &&
                    frames[routine.frames.map((f) => f.id).indexOf(x.frame?.id)]
                  }
                  draggable={false}
                />
                <ConditionOverlay
                  preview={[x]}
                  templateRegions={condition.regions}
                  threshold={condition.threshold}
                  width={width}
                  height={height}
                  max
                />
              </div>
            ))}
          </div>
        </div>
      </Modal>
    )
  );
}
