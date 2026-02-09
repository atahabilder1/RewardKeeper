export default function Rubric({ rewardGroups, onGroupsChange, totalWeeks }) {
  const handleStartChange = (i, value) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1) return;
    const updated = [...rewardGroups];
    updated[i] = { ...updated[i], start: Math.min(num, updated[i].end) };
    onGroupsChange(updated);
  };

  const handleEndChange = (i, value) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1) return;
    const updated = [...rewardGroups];
    updated[i] = { ...updated[i], end: Math.max(num, updated[i].start) };
    onGroupsChange(updated);
  };

  const handleRewardChange = (i, value) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 0) return;
    const updated = [...rewardGroups];
    updated[i] = { ...updated[i], reward: num };
    onGroupsChange(updated);
  };

  const addGroup = () => {
    const last = rewardGroups[rewardGroups.length - 1];
    const newStart = last.end + 1;
    if (newStart > totalWeeks) return;
    const splitAt = Math.floor((last.start + totalWeeks) / 2);
    const newEnd = Math.max(last.start, Math.min(splitAt, totalWeeks - 1));
    const updated = [...rewardGroups];
    updated[updated.length - 1] = { ...last, end: newEnd };
    updated.push({ start: newEnd + 1, end: totalWeeks, reward: last.reward + 10 });
    onGroupsChange(updated);
  };

  const removeGroup = (i) => {
    if (rewardGroups.length <= 1) return;
    const updated = [...rewardGroups];
    updated.splice(i, 1);
    onGroupsChange(updated);
  };

  const lastGroup = rewardGroups[rewardGroups.length - 1];
  const canAdd = lastGroup.end < totalWeeks;

  return (
    <div className="card rubric">
      <h2>Reward Rubric</h2>
      <p>
        Bits are rewards earned in addition to the grade earned for an
        assignment, which can be exchanged for items in the associated Bit
        Bazaar for redeemable items, such as extra credit, lab attendance pass,
        etc.
      </p>

      <table className="rubric-table">
        <thead>
          <tr>
            <th>Weeks</th>
            {rewardGroups.map((g, i) => (
              <th key={i}>
                <span className="group-header">
                  <input
                    className="rubric-end-input"
                    type="number"
                    min="1"
                    value={g.start}
                    onChange={(e) => handleStartChange(i, e.target.value)}
                  />
                  <span className="group-sep">-</span>
                  <input
                    className="rubric-end-input"
                    type="number"
                    min={g.start}
                    value={g.end}
                    onChange={(e) => handleEndChange(i, e.target.value)}
                  />
                </span>
              </th>
            ))}
            <th className="group-actions-header">
              <button
                type="button"
                className="group-add-btn"
                onClick={addGroup}
                disabled={!canAdd}
                title="Add group"
              >+</button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Bit Reward</strong></td>
            {rewardGroups.map((g, i) => (
              <td key={i}>
                <input
                  className="rubric-input"
                  type="number"
                  min="0"
                  value={g.reward}
                  onChange={(e) => handleRewardChange(i, e.target.value)}
                />
              </td>
            ))}
            <td></td>
          </tr>
          <tr>
            <td></td>
            {rewardGroups.map((_, i) => (
              <td key={i}>
                {rewardGroups.length > 1 && (
                  <button
                    type="button"
                    className="group-remove-btn"
                    onClick={() => removeGroup(i)}
                    title="Remove group"
                  >Remove</button>
                )}
              </td>
            ))}
            <td></td>
          </tr>
        </tbody>
      </table>

      <p>
        For labs, a student can earn bits in the Debug Dungeons in the following
        ways:
      </p>
      <ul>
        <li>
          Being the first among 5 people to submit correct solutions (at least
          1 of the versions): X Bit Reward
        </li>
        <li>
          Maintaining a streak of perfect submissions on Dungeons (meaning
          submitting both versions for 4 weeks straight for example): X Bit
          Reward
        </li>
        <li>
          Completing both Debug Dungeons for the week: X Bit Reward
        </li>
      </ul>

      <h3>Streak</h3>
      <p>
        If students completed the previous Debug Dungeon perfectly and finished
        the current Debug Dungeon perfectly, they earn the Streak Reward.
      </p>
    </div>
  );
}
