export const normalizeInwardTestType = (testType) => {
  const value = String(testType || "").trim().toLowerCase();
  if (!value) return "";
  if (value === "pre_test" || value === "pre-testing" || value === "pre_testing") return "pre_testing";
  if (value === "post_test" || value === "post-testing" || value === "post_testing") return "post_testing";
  if (value === "re_test" || value === "re-testing" || value === "re_testing") return "re_testing";
  return value;
};

export const getInwardTestBreakdownId = (test) => {
  if (!test) return null;
  if (test.breakdown?.id != null) return test.breakdown.id;
  if (test.breakdown_id != null) return test.breakdown_id;
  return null;
};

export const hasValidInwardTestValue = (test) => {
  if (!test) return false;
  const value = test.value;
  if (value === null || value === undefined || value === "") return false;
  const text = String(value).trim();
  return text !== "" && text !== "-";
};

export const getLatestInwardTest = (tests = []) => {
  if (!tests.length) return null;
  return [...tests].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
    const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
    return dateB - dateA;
  })[0];
};

export const partitionInwardLabTests = (labTests = []) => {
  const preTests = [];
  const postTests = [];
  const reTests = [];

  labTests.forEach((test) => {
    const type = normalizeInwardTestType(test.test_type);
    if (type === "pre_testing") preTests.push(test);
    else if (type === "post_testing") postTests.push(test);
    else if (type === "re_testing") reTests.push(test);
  });

  return { preTests, postTests, reTests };
};

export const collectInwardTestBreakdowns = (tests = [], weightBreakdowns = []) => {
  const breakdownMap = new Map();
  const weightLookup = new Map((weightBreakdowns || []).map((breakdown) => [breakdown.id, breakdown]));

  tests.forEach((test) => {
    const breakdownId = getInwardTestBreakdownId(test);
    if (breakdownId == null) return;

    if (!breakdownMap.has(breakdownId)) {
      const fromTest = test.breakdown;
      const fromWeight = weightLookup.get(breakdownId);
      breakdownMap.set(breakdownId, {
        id: breakdownId,
        status_type:
          fromTest?.status_type_display ||
          fromTest?.status_type ||
          fromWeight?.status_type_display ||
          fromWeight?.status_type ||
          "Breakdown",
        number_of_bags:
          fromTest?.number_of_bags ??
          fromWeight?.number_of_bags ??
          "",
      });
    }
  });

  return Array.from(breakdownMap.values());
};

export const groupInwardTestsByBreakdown = (tests = []) =>
  tests.reduce((acc, test) => {
    const key = getInwardTestBreakdownId(test) ?? "main";
    if (!acc[key]) acc[key] = [];
    acc[key].push(test);
    return acc;
  }, {});

export const buildInwardLabTestTableModel = (labTests = [], weightBreakdowns = []) => {
  const { preTests, postTests, reTests } = partitionInwardLabTests(labTests);
  const postTestBreakdowns = collectInwardTestBreakdowns(
    [...postTests, ...reTests],
    weightBreakdowns
  );
  const hasBreakdownTests = postTestBreakdowns.length > 0;
  const hasMainItemPostTests = postTests.some((test) => getInwardTestBreakdownId(test) == null);
  const hasMainItemReTests = reTests.some(
    (test) => getInwardTestBreakdownId(test) == null && hasValidInwardTestValue(test)
  );

  const breakdownHasReTests = (breakdownId) =>
    reTests.some(
      (test) =>
        getInwardTestBreakdownId(test) === breakdownId && hasValidInwardTestValue(test)
    );

  const reTestBreakdowns = postTestBreakdowns.filter((breakdown) =>
    breakdownHasReTests(breakdown.id)
  );

  const allParams = [
    ...new Set([...preTests, ...postTests, ...reTests].map((test) => test.parameter_name)),
  ];

  const postColCount =
    (hasBreakdownTests ? postTestBreakdowns.length : 0) + (hasMainItemPostTests ? 1 : 0);
  const showAggregatedPostColumn = postColCount === 0 && postTests.length > 0;
  const effectivePostColCount = showAggregatedPostColumn ? 1 : postColCount;
  const reColCount =
    reTestBreakdowns.length + (hasMainItemReTests ? 1 : 0);
  const hasSecondHeaderRow = effectivePostColCount > 0 || reColCount > 0;

  return {
    preTests,
    postTests,
    reTests,
    allParams,
    postTestBreakdowns,
    reTestBreakdowns,
    hasBreakdownTests,
    hasMainItemPostTests,
    hasMainItemReTests,
    postColCount: effectivePostColCount,
    reColCount,
    hasSecondHeaderRow,
    showAggregatedPostColumn,
    breakdownHasReTests,
    groupByBreakdown: groupInwardTestsByBreakdown,
    getLatestTest: getLatestInwardTest,
    hasValidTestValue: hasValidInwardTestValue,
  };
};

export const formatInwardTestValue = (test) => {
  if (!test) return "-";
  const value = test.value ?? "N/A";
  const unit = test.unit ? ` ${test.unit}` : "";
  return `${value}${unit}`;
};

const parseNumericInwardTestValue = (test) => {
  if (!hasValidInwardTestValue(test)) return null;
  const num = parseFloat(String(test.value).replace(/,/g, "").trim());
  if (Number.isNaN(num)) return null;
  return {
    num,
    unit: test.unit ? String(test.unit).trim() : "",
  };
};

/** Post-testing minus pre-testing.
 * Increase (post > pre): "+3" (or with unit) — callers may bold this.
 * Decrease (post < pre): absolute value without minus, e.g. "2".
 * If one side is 0/missing and the other has a value, show that non-zero value.
 * Returns "0" when both sides are missing or 0.
 */
export const computeInwardTestDifferenceDetails = (preTest, postTest) => {
  const pre = parseNumericInwardTestValue(preTest);
  const post = parseNumericInwardTestValue(postTest);

  const formatNumber = (num) =>
    Number.isInteger(num) || Math.abs(num % 1) < 0.0001
      ? String(Math.round(num))
      : String(Number(num.toFixed(2)));

  const withUnit = (value, unit) => (unit ? `${value} ${unit}` : value);

  const preNum = pre?.num;
  const postNum = post?.num;
  const preHasValue = pre != null && preNum !== 0;
  const postHasValue = post != null && postNum !== 0;
  const preIsZeroOrMissing = pre == null || preNum === 0;
  const postIsZeroOrMissing = post == null || postNum === 0;

  // Pre has value, post is 0/missing → show pre value
  if (preHasValue && postIsZeroOrMissing) {
    return {
      text: withUnit(formatNumber(preNum), pre.unit || post?.unit || ""),
      isIncrease: false,
    };
  }

  // Post has value, pre is 0/missing → show post value
  if (postHasValue && preIsZeroOrMissing) {
    return {
      text: withUnit(formatNumber(postNum), post.unit || pre?.unit || ""),
      isIncrease: false,
    };
  }

  if (!pre || !post) {
    return { text: "0", isIncrease: false };
  }

  const diff = post.num - pre.num;
  const absDiff = Math.abs(diff);
  const formattedAbs = formatNumber(absDiff);
  const unit = pre.unit || post.unit;

  if (diff > 0) {
    return { text: withUnit(`+${formattedAbs}`, unit), isIncrease: true };
  }

  if (diff < 0) {
    return { text: withUnit(`-${formattedAbs}`, unit), isIncrease: false };
  }

  return { text: withUnit(formattedAbs, unit), isIncrease: false };
};

export const computeInwardTestDifference = (preTest, postTest) =>
  computeInwardTestDifferenceDetails(preTest, postTest).text;

export const enrichInwardLabTestsWithBreakdowns = (labTests = [], weightBreakdowns = []) => {
  const lookup = new Map((weightBreakdowns || []).map((breakdown) => [breakdown.id, breakdown]));

  return (labTests || []).map((test) => {
    if (test.breakdown) return test;

    const breakdownId = getInwardTestBreakdownId(test);
    if (breakdownId == null) return test;

    const match = lookup.get(breakdownId);
    if (!match) return test;

    return {
      ...test,
      breakdown: {
        id: match.id,
        status_type: match.status_type,
        status_type_display: match.status_type_display || match.status_type,
        number_of_bags: match.number_of_bags,
        weight: match.weight,
        remarks: match.remarks,
      },
    };
  });
};
