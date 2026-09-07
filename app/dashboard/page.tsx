"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";

const initial = { todaySales: 0, totalOrders: 0, totalProducts: 0, lowStockItems: 0 };
const money = (value:number) => `${new Intl.NumberFormat("en-US").format(value)} MMK`;
export default function DashboardPage(){
  const [stats,setStats]=useState(initial);
  useEffect(()=>{ window.electron?.dashboard?.getStats().then(setStats).catch(()=>setStats(initial)); },[]);
  const cards=[["Today's Sales",money(stats.todaySales)],["Total Orders",String(stats.totalOrders)],["Total Products",String(stats.totalProducts)],["Low Stock Items",String(stats.lowStockItems)]];
  return <AppShell><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}><div><h1 style={{margin:0,fontSize:32}}>Dashboard</h1><p style={{color:"#667085",marginTop:6}}>Overview of your shop today.</p></div><a href="/sales" style={{background:"#1769e0",color:"#fff",padding:"12px 18px",borderRadius:10,fontWeight:700}}>New Sale</a></div><section style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:16,marginBottom:20}}>{cards.map(([label,value])=><div key={label} style={{background:"#fff",border:"1px solid #e8edf5",borderRadius:14,padding:18}}><div style={{color:"#667085",fontSize:14}}>{label}</div><div style={{fontSize:26,fontWeight:800,marginTop:10}}>{value}</div></div>)}</section><section style={{display:"grid",gridTemplateColumns:"1.25fr 1fr",gap:16}}><div style={{background:"#fff",border:"1px solid #e8edf5",borderRadius:14,padding:18,minHeight:280}}><h3 style={{marginTop:0}}>Sales Overview</h3><p style={{color:"#98a2b3"}}>Sales activity will appear here.</p></div><div style={{background:"#fff",border:"1px solid #e8edf5",borderRadius:14,padding:18,minHeight:280}}><h3 style={{marginTop:0}}>Recent Sales</h3><p style={{color:"#98a2b3"}}>Open Sales History to review completed sales.</p></div></section></AppShell>}
