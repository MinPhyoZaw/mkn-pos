
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {LayoutDashboard,ShoppingCart,ClipboardList,Package,Tags,Layers3,History,BarChart3,DatabaseBackup,Settings} from "lucide-react";
const links=[
{href:"/dashboard",label:"Dashboard",icon:LayoutDashboard},
{href:"/sales",label:"အရောင်းစာမျက်နှာ",icon:ShoppingCart},
{href:"/orders",label:"အော်ဒါများ",icon:ClipboardList},
{href:"/products",label:"ကုန်ပစ္စည်းများ",icon:Package},
{href:"/categories",label:"အမျိုးအစားများ",icon:Tags},
{href:"/stock",label:"လက်ကျန်",icon:Layers3},
{href:"/sales-history",label:"အရောင်းမှတ်တမ်း",icon:History},
{href:"/reports",label:"တင်ပြချက်များ",icon:BarChart3},
{href:"/backup",label:"Backup / Restore",icon:DatabaseBackup},
{href:"/settings",label:"Settings",icon:Settings},
];
export default function Sidebar(){const pathname=usePathname();return <aside className="app-sidebar"><div className="sidebar-brand"><span className="sidebar-brand-mark">DJN</span><div><i>Daw Ja Nu </i><small>Point of Sale</small></div></div><nav className="sidebar-nav">{links.map(({href,label,icon:Icon},index)=>{const active=pathname===href||(href!=="/dashboard"&&pathname.startsWith(href));return <Link className={`sidebar-menu-link${active?" active":""}`} key={`${href}-${index}`} href={href}><Icon size={18}/><span>{label}</span></Link>})}</nav></aside>}
