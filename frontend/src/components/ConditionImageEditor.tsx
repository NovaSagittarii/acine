import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import * as pb from 'acine-proto-dist';
import { Routine_Condition_Image_Method as Method } from 'acine-proto-dist';

import Button from './ui/Button';
import ConditionOverlay from './ConditionOverlay';
import Modal from './ui/Modal';
import NumberInput from './ui/NumberInput';
import RegionEditor from './ui/RegionEditor';
import Select, { SelectAuto } from './ui/Select';

import { $frames, $routine, $sourceDimensions } from '@/state';
import { $condition } from './ConditionImageEditor.state';
import { getImageUrl, runtimeConditionQuery } from '../App.state';
import useForceUpdate from './useForceUpdate';
import useShortcut from './useShortcut';

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
  function EscapeShortcut() {
    /** NOTE: this is getting repeated loaded/unloaded, some circular dep here? */
    useShortcut('Close ConditionImageEditor', 'Escape', (_event) => close());
    return <></>;
  }

  const [src, setSrc] = useState<string>('');
  const [currFrameId, setCurrFrameId] = useState<string>(
    Object.keys(frames)[0],
  );
  useEffect(() => {
    if (condition !== null) {
      setOpen(true);
      const { frameId } = condition;
      if (frameId) {
        setCurrFrameId(frameId);
        setSrc(getImageUrl(frameId));
        console.log('with condition, call set src', condition);
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
        if (condition) {
          condition.frameId = currFrameId;
          setSrc(getImageUrl(currFrameId));
          changed = true;
        }
      }
      if (changed) forceUpdate();
    }
  }, [condition, currFrameId]); // adding dep forceUpdate makes it spam reload

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
  const [isBusy, setBusy] = useState(false);

  const refreshPreview = (manual: boolean = false) => {
    forceUpdate();
    if (condition) {
      if (!manual && condition.regions && condition.allowRegions.length) {
        // suppress auto refresh when there are allow regions being used.
        // those are heavy queries.
        return;
      }
      const c = pb.Routine_Condition.create({
        condition: { $case: 'image', image: condition },
      });
      setBusy(true);
      runtimeConditionQuery(c)
        .then((w) => setPreview(w))
        .catch((e) => console.error('Failed condition query.', e))
        .finally(() => setBusy(false));
    }
  };

  return (
    condition && (
      <Modal isOpen={open} onClose={() => close()}>
        {open && <EscapeShortcut />}
        <div className='flex flex-col m-12 grow bg-white pointer-events-auto'>
          <SelectAuto
            value={condition.frameId || undefined}
            values={Object.keys(frames)}
            onChange={(frameId) => {
              if (frameId) {
                condition.frameId = frameId;
                setCurrFrameId(frameId);
                refreshPreview();
              }
            }}
            autofocus
          />
          <div className='flex items-center gap-6'>
            <Button
              className='hover:bg-amber-100'
              onClick={() => refreshPreview(true)}
            >
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
            {condition.regions && condition.allowRegions.length ? (
              <div className='text-red-800'>
                Auto-query is being suppressed.
              </div>
            ) : (
              <div className='text-green-800'>Auto-query active.</div>
            )}
            {isBusy && (
              <div className='flex gap-2 text-blue-500'>
                <div className='animate-spin font-mono font-bold'>+</div>
                <div>Running</div>
              </div>
            )}
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
                    src={p.frame?.id && getImageUrl(p.frame.id)}
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
                  src={x.frame?.id && getImageUrl(x.frame.id)}
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
