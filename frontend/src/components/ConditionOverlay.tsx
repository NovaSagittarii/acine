import * as pb from 'acine-proto-dist';

import { runtimeConditionQuery } from '../App.state';
import { useEffect, useState } from 'react';
import Region from './ui/Region';

const RECT_DRAW_LIMIT = 300;

enum MatchType {
  PRIMARY = 0, // the highest scored match
  SECONDARY = 1, // above threshold but not highest
  BELOW_THRESHOLD = 2,
  WEAK_PRIMARY = 3, // below threshold, but highest
}

interface ConditionOverlayProps {
  preview: Awaited<ReturnType<typeof runtimeConditionQuery>>;
  templateRegions: pb.Rect[];
  threshold: number;
  width: number;
  height: number;
}

/**
 * Displays regions from match results.
 */
export default function ConditionOverlay({
  preview,
  templateRegions,
  threshold,
  width,
  height,
}: ConditionOverlayProps) {
  const [matchResults, setMatchResults] = useState<
    {
      rect: pb.Rect;
      score: number;
      matchType: MatchType;
      firstInGroup: boolean;
    }[]
  >([]);
  useEffect(() => {
    setMatchResults(
      templateRegions
        .flatMap(({ top, bottom, left, right }, rindex, a) =>
          preview.flatMap((p) =>
            p.matches.map(({ score, position }, index) => ({
              rect: pb.Rect.create({
                top: position!.y + top - a[0].top,
                left: position!.x + left - a[0].left,
                bottom: position!.y + (bottom - a[0].top),
                right: position!.x + (right - a[0].left),
              }),
              score,
              matchType:
                index === 0
                  ? score >= threshold
                    ? MatchType.PRIMARY
                    : MatchType.WEAK_PRIMARY
                  : score >= threshold
                    ? MatchType.SECONDARY
                    : MatchType.BELOW_THRESHOLD,
              firstInGroup: rindex === 0,
            })),
          ),
        )
        .splice(0, RECT_DRAW_LIMIT), // limit to prevent lag
    );
  }, [templateRegions, preview, threshold]);
  return (
    <>
      {matchResults.map(({ rect, score, matchType, firstInGroup }, index) => (
        <Region
          key={index}
          region={rect}
          width={width}
          height={height}
          color={
            [
              'outline-green-400/30',
              'outline-amber-300/20',
              'outline-red-300/15',
              'outline-green-100/20',
            ][matchType.valueOf()]
          }
        >
          <div
            className={`${firstInGroup || 'opacity-20'} ${matchType === MatchType.PRIMARY ? 'text-black/75' : 'text-black/20'}`}
          >
            {score.toFixed(5)}
          </div>
        </Region>
      ))}
      <div className='absolute bottom-0 right-0 text-black/50'>
        {matchResults.length}/{RECT_DRAW_LIMIT}
      </div>
    </>
  );
}
