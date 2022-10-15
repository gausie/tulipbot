import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { roundToNearestMinutes, format } from "date-fns";

type Price = { time: number; red: number; white: number; blue: number };

function DateFormatter(time: string | number) {
  if (typeof time !== "number") {
    return time;
  }

  const date = new Date(time);

  return format(
    roundToNearestMinutes(date, { nearestTo: 30, roundingMethod: "floor" }),
    "P HH:mm"
  );
}

const ActiveDot = (props: any) => {
  const { cx, cy, dataKey } = props;
  return (
    <image
      key={props.key}
      x={cx - 10}
      y={cy - 10}
      href="/tulip.png"
      height={20}
      width={20}
      className={`dot-${dataKey}`}
    />
  );
};

export default function App() {
  const [data, setData] = useState([] as Price[]);

  useEffect(() => {
    async function load() {
      const response = await fetch("https://tulipbot.ar.gy/prices");
      const prices: Price[] = await response.json();
      setData(prices);
    }

    load();
  }, []);

  return (
    <div id="container">
      <h1>
        <img className="flip" src="/tulip.png" /> Tulip Prices{" "}
        <img src="/tulip.png" />
      </h1>
      <ResponsiveContainer height="80%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" tickFormatter={DateFormatter} />
          <YAxis
            domain={[0, 30]}
            width={40}
            ticks={[0, 5, 10, 15, 20, 25, 30]}
          />
          <Tooltip labelFormatter={DateFormatter} />
          <ReferenceLine
            y={28}
            label="Max"
            stroke="grey"
            strokeDasharray="3 3"
          />
          <ReferenceLine
            y={2}
            label="Min"
            stroke="grey"
            strokeDasharray="3 3"
          />
          <Line
            type="monotone"
            dataKey="red"
            stroke="#ff0000"
            isAnimationActive={false}
            activeDot={<ActiveDot />}
          />
          <Line
            type="monotone"
            dataKey="white"
            stroke="#aaaaaa"
            isAnimationActive={false}
            activeDot={<ActiveDot />}
          />
          <Line
            type="monotone"
            dataKey="blue"
            stroke="#0000ff"
            isAnimationActive={false}
            activeDot={<ActiveDot />}
          />
          <Brush
            dataKey="time"
            height={30}
            stroke="#8884d8"
            tickFormatter={DateFormatter}
            travellerWidth={20}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
