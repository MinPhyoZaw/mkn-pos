
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {LayoutDashboard,ShoppingCart,ClipboardList,Package,Tags,Layers3,History,BarChart3,DatabaseBackup,Settings} from "lucide-react";
const links=[
{href:"/dashboard",label:"Dashboard",icon:LayoutDashboard},
{href:"/sales",label:"New Sale",icon:ShoppingCart},
{href:"/orders",label:"Orders",icon:ClipboardList},
{href:"/products",label:"Products",icon:Package},
{href:"/categories",label:"Categories",icon:Tags},
{href:"/stock",label:"Stock",icon:Layers3},
{href:"/sales-history",label:"Sales History",icon:History},
{href:"/reports",label:"Reports",icon:BarChart3},
{href:"/backup",label:"Backup / Restore",icon:DatabaseBackup},
{href:"/settings",label:"Settings",icon:Settings},
];
export default function Sidebar(){const pathname=usePathname();return <aside className="app-sidebar"><div className="sidebar-brand"><span className="sidebar-brand-mark">TS</span><div><strong>Toy &amp; Stationery</strong><small>Point of Sale</small></div></div><nav className="sidebar-nav">{links.map(({href,label,icon:Icon},index)=>{const active=pathname===href||(href!=="/dashboard"&&pathname.startsWith(href));return <Link className={`sidebar-menu-link${active?" active":""}`} key={`${href}-${index}`} href={href}><Icon size={18}/><span>{label}</span></Link>})}</nav></aside>}
