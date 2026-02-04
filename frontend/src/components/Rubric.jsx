export default function Rubric() {
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
            <th>1-4</th>
            <th>5-8</th>
            <th>9-12</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Bit Reward</strong></td>
            <td>10</td>
            <td>20</td>
            <td>30</td>
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
