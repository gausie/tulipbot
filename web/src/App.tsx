import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

type RawPrice = { time: number, red: number, white: number, blue: number };
type Price = Omit<RawPrice, 'time'> & { time: Date };

export default function App() {
  const [data, setData] = useState([] as Price[]);
  
  useEffect(() => {
    async function load() {
      const response = await fetch("/prices");
      const prices: RawPrice[] = await response.json();
      setData(prices.map(p => ({ ...p, time: new Date(p.time)})));
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
        <XAxis dataKey="time" hide={true} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="red" stroke="#ff0000" />
        <Line type="monotone" dataKey="white" stroke="#aaaaaa" />
        <Line type="monotone" dataKey="blue" stroke="#0000ff" />
      </LineChart>
    </div>
  );
}
