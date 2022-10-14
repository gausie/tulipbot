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

export default function App() {
  const [data, setData] = useState([] as Price[]);

  useEffect(() => {
    async function load() {
      const response = await fetch("/prices");
      const prices: Price[] = await response.json();
      setData(prices);
    }

    load();
  }, []);

  return (
    <div>
      <h1>Tulip Prices</h1>
      <LineChart
        width={700}
        height={400}
        data={data}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" tickFormatter={DateFormatter} />
        <YAxis />
        <Tooltip labelFormatter={DateFormatter} />
        <Legend />
        <Line type="monotone" dataKey="red" stroke="#ff0000" />
        <Line type="monotone" dataKey="white" stroke="#aaaaaa" />
        <Line type="monotone" dataKey="blue" stroke="#0000ff" />
        <Brush
          dataKey="time"
          height={30}
          stroke="#8884d8"
          tickFormatter={DateFormatter}
        />
      </LineChart>
    </div>
  );
}
