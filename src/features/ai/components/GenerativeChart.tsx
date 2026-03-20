"use client";
import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface DataPoint {
  name: string;
  value: number;
}

export function GenerativeChart({ data, title }: { data: DataPoint[], title: string }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full sm:w-[500px] h-[320px] max-w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-5 mt-2 mb-4">
      <h3 className="text-zinc-100 font-medium text-[15px] tracking-wide">{title}</h3>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, left: -20, right: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis 
              dataKey="name" 
              stroke="#71717a" 
              fontSize={11} 
              tickLine={false} 
              axisLine={false} 
              dy={10}
            />
            <YAxis 
              stroke="#71717a" 
              fontSize={11} 
              tickLine={false} 
              axisLine={false} 
            />
            <Tooltip 
              cursor={{ fill: '#27272a', opacity: 0.5 }}
              contentStyle={{ 
                backgroundColor: '#18181b', 
                border: '1px solid #3f3f46', 
                borderRadius: '12px', 
                color: '#fff',
                fontSize: '13px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
              }}
              itemStyle={{ color: '#14b8a6', fontWeight: 600 }}
            />
            <Bar 
              dataKey="value" 
              fill="#14b8a6" 
              radius={[6, 6, 0, 0]} 
              activeBar={{ fill: '#2dd4bf' }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
