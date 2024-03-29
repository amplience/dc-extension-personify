import React, { useState, useEffect } from 'react';
import { withStyles, WithStyles, Theme } from '@material-ui/core';
import CoverageReport from '../CoverageReport/CoverageReport';
import useInterval from 'react-useinterval';
import { fetchMissionData } from '../../services/fetchMissionData';
import { useSdkContext } from '../SdkContext';
import { withRetry } from '../../utils/withRetry';
import { Criteria } from '../ManagedCriteria';
import { isDefined } from '../../utils/isDefined';
import useDidMountEffect from '../../hooks/useDidMountEffect';

const styles = (theme: Theme) => ({});

interface Props extends WithStyles<typeof styles> {
  className?: string;
  style?: React.CSSProperties;
}

const ManagedCoverageReport = (props: Props) => {
  const sdk = useSdkContext();
  const errorMessage =
    'Sorry, we are unable to calculate relevancy scores due to a problem retrieving the necessary data.';

  const [criteria, setCriteria] = useState<Criteria>({
    missions: null,
    tags: null,
  });
  const [value, setValue] = useState(0);
  const [unsaved, setUnsaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [suggestedTarget, setSuggestedTarget] = useState<any>(null);
  const [error, setError] = useState();

  const getFormValue = async (): Promise<any> => {
    let value = {};
    try {
      return await sdk.form.getValue();
    } catch (error) {
      setUnsaved(true);
      return value;
    }
  };

  const fetchContent = async () => {
    if (!sdk) {
      return;
    }

    try {
      const { groups = [] } = await getFormValue();
      let foundMissions: string[] = [];
      let foundTags: string[] = [];

      for (let group of groups) {
        const { behaviors = [], tags = [] } = group.criteria || {};
        foundMissions = [...foundMissions, ...(behaviors || [])];
        foundTags = [...foundTags, ...(tags || [])];
      }

      foundMissions = Array.from(new Set(foundMissions));
      foundTags = Array.from(new Set(foundTags));

      if (
        foundMissions.join(',') !== criteria.missions?.join(',') ||
        foundTags.join(',') !== criteria.tags?.join(',')
      ) {
        setCriteria({
          missions: foundMissions,
          tags: foundTags,
        });
      }
    } catch (err) {
      console.debug('Unable to fetch content', err);
      err.message = errorMessage;
      setError(err);
    }
  };

  const fetchCoverageReport = async () => {
    try {
      setIsLoading(true);
      const data = await withRetry(() => fetchMissionData(sdk?.params.instance.apiUrl, criteria), 'personify coverage');
      const { coverage, suggested_target, missions } = data;

      if (isDefined(coverage)) {
        setValue(coverage);
      }

      if (suggested_target && suggested_target.target !== undefined) {
        if (suggested_target.type === 'TAG') {
          setSuggestedTarget({
            target: suggested_target.target,
            type: 'TAG',
            coverage: suggested_target.possible_coverage,
          });
        } else {
          const mission = missions.find((x: any) => x.mission_id === suggested_target.target);
          if (mission) {
            setSuggestedTarget({
              target: mission.mission_name,
              type: 'MISSION',
              coverage: suggested_target.possible_coverage,
            });
          } else {
            setSuggestedTarget(null);
          }
        }
      }
    } catch (err) {
      console.debug('Unable to fetch coverage', err);
      err.message = errorMessage;
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useDidMountEffect(() => {
    fetchCoverageReport();
  }, [criteria]);

  useEffect(() => {
    fetchContent();
  }, []);

  useInterval(fetchContent, 3000);

  return (
    <CoverageReport
      value={value}
      loading={isLoading}
      unsaved={unsaved}
      error={error}
      missions={criteria.missions}
      tags={criteria.tags}
      suggestedTarget={suggestedTarget}
    />
  );
};

export default withStyles(styles)(ManagedCoverageReport);
