"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import type { Order, OrderInput, OrderItem, OrderStatus, PaymentStatus, Product } from "@/types/electron";
import "./orders.css";

const statuses: OrderStatus[] = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"];
const payments: PaymentStatus[] = ["UNPAID", "PAID"];
const label = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();
const money = (value: number) => `${new Intl.NumberFormat("en-US").format(value)} MMK`;
const dateInput = (value: string | Date) => new Date(value).toISOString().slice(0, 10);
const emptyForm = (): OrderInput => ({ customerName: "", phone: "", address: "", orderDate: dateInput(new Date()), notes: "", paymentStatus: "UNPAID", status: "PENDING", items: [] });
const getElectronApi = () => (typeof window !== "undefined" ? (window as any).electron : undefined);

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [detail, setDetail] = useState<Order | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<OrderInput>(emptyForm());
  const [productSearch, setProductSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const electronApi = getElectronApi();
      if (!electronApi?.orders?.getAll || !electronApi?.products?.getAll) {
        throw new Error("Unable to load products.\nPlease restart the POS application.");
      }

      const [orderRows, productRows] = await Promise.all([electronApi.orders.getAll(), electronApi.products.getAll()]);
      setOrders(orderRows);
      setProducts(productRows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load orders.";
      setError(message);
      setProducts([]);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => orders.filter((order) => {
    const query = search.trim().toLowerCase();
    return (!query || order.customerName.toLowerCase().includes(query) || order.phone.toLowerCase().includes(query)) &&
      (statusFilter === "ALL" || order.status === statusFilter) && (paymentFilter === "ALL" || order.paymentStatus === paymentFilter);
  }), [orders, search, statusFilter, paymentFilter]);
  const productResults = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return products.filter((p) => !query || p.name.toLowerCase().includes(query)).slice(0, 8);
  }, [products, productSearch]);
  const total = form.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const openCreate = () => { setForm(emptyForm()); setEditingId(null); setError(""); setProductSearch(""); setFormOpen(true); };
  const openEdit = (order: Order) => {
    setDetail(null); setEditingId(order.id); setError(""); setProductSearch("");
    setForm({ customerName: order.customerName, phone: order.phone, address: order.address, orderDate: dateInput(order.orderDate), notes: order.notes ?? "", paymentStatus: order.paymentStatus, status: order.status, items: order.items.map((item) => ({ ...item })) });
    setFormOpen(true);
  };
  const addProduct = (product: Product) => setForm((current) => {
    const found = current.items.find((item) => item.productId === product.id);
    const items = found ? current.items.map((item) => item.productId === product.id ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unitPrice } : item) : [...current.items, { productId: product.id, productName: product.name, unitPrice: product.sellingPrice, quantity: 1, subtotal: product.sellingPrice }];
    return { ...current, items };
  });
  const quantity = (index: number, change: number) => setForm((current) => ({ ...current, items: current.items.flatMap((item, i) => i !== index ? [item] : item.quantity + change <= 0 ? [] : [{ ...item, quantity: item.quantity + change, subtotal: item.unitPrice * (item.quantity + change) }]) }));
  const remove = (index: number) => setForm((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }));

  const save = async () => {
    setError("");
    if (!form.customerName.trim()) return setError("Customer name is required.");
    if (!form.phone.trim()) return setError("Phone number is required.");
    if (!form.address.trim()) return setError("Address is required.");
    if (!form.items.length) return setError("Add at least one product to the order.");
    setSaving(true);
    try {
      const electronApi = getElectronApi();
      if (!electronApi?.orders?.create && !electronApi?.orders?.update) {
        throw new Error("Unable to save order.\nPlease restart the POS application.");
      }

      const payload = { ...form, items: form.items.map((item) => ({ ...item, subtotal: item.unitPrice * item.quantity })) };
      const saved = editingId === null ? await electronApi.orders.create(payload) : await electronApi.orders.update(editingId, payload);
      await load(); setFormOpen(false); setNotice(`Order #${saved.id} ${editingId === null ? "created" : "updated"} successfully.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save order."); }
    finally { setSaving(false); }
  };
  const changeStatus = async (order: Order, status: OrderStatus) => { try { const electronApi = getElectronApi(); if (!electronApi?.orders?.updateStatus) { throw new Error("Unable to update status.\nPlease restart the POS application."); } const updated = await electronApi.orders.updateStatus(order.id, status); setOrders((rows) => rows.map((row) => row.id === updated.id ? updated : row)); setDetail(updated); } catch (err) { setError(err instanceof Error ? err.message : "Unable to update status."); } };
  const changePayment = async (order: Order) => { const next = order.paymentStatus === "PAID" ? "UNPAID" : "PAID"; try { const electronApi = getElectronApi(); if (!electronApi?.orders?.updatePaymentStatus) { throw new Error("Unable to update payment.\nPlease restart the POS application."); } const updated = await electronApi.orders.updatePaymentStatus(order.id, next); setOrders((rows) => rows.map((row) => row.id === updated.id ? updated : row)); setDetail(updated); } catch (err) { setError(err instanceof Error ? err.message : "Unable to update payment."); } };
  const cancelOrder = async (order: Order) => { if (!window.confirm(`Cancel Order #${order.id}?\n\nThe order will remain in your business history.`)) return; await changeStatus(order, "CANCELLED"); };
  const deleteOrder = async (order: Order) => { if (!window.confirm(`Delete Order #${order.id}?\n\nThis action cannot be undone.`)) return; try { const electronApi = getElectronApi(); if (!electronApi?.orders?.delete) { throw new Error("Unable to delete order.\nPlease restart the POS application."); } await electronApi.orders.delete(Number(order.id)); setDetail(null); await load(); setNotice(`Order #${order.id} deleted.`); } catch (err) { setError(err instanceof Error ? err.message : "Unable to delete order."); } };

  return <AppShell><div className="orders-page">
    <header className="orders-header"><div><h1>Orders</h1><p>Manage customer orders and payment status</p></div><button className="primary" onClick={openCreate}>+ New Order</button></header>
    {notice && <div className="notice">{notice}</div>}{error && !formOpen && <div className="error">{error}</div>}
    <section className="summary-grid">{[["Total Orders", orders.length], ["Pending", orders.filter(o=>o.status==="PENDING").length], ["Unpaid", orders.filter(o=>o.paymentStatus==="UNPAID").length], ["Completed", orders.filter(o=>o.status==="COMPLETED").length]].map(([name,value])=><div className="summary" key={name}><span>{name}</span><strong>{value}</strong></div>)}</section>
    <div className="filters"><input placeholder="Search customer / phone..." value={search} onChange={e=>setSearch(e.target.value)}/><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="ALL">Status: All</option>{statuses.map(s=><option key={s} value={s}>{label(s)}</option>)}</select><select value={paymentFilter} onChange={e=>setPaymentFilter(e.target.value)}><option value="ALL">Payment: All</option>{payments.map(s=><option key={s} value={s}>{label(s)}</option>)}</select></div>
    <div className="table-card"><table><thead><tr><th>Order</th><th>Customer</th><th>Phone</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {loading && <tr><td colSpan={8} className="empty">Loading orders...</td></tr>}
      {!loading && !filtered.length && <tr><td colSpan={8}><div className="empty"><strong>No orders yet</strong><span>Customer orders will appear here.</span><button className="primary" onClick={openCreate}>+ Create First Order</button></div></td></tr>}
      {filtered.map(order=><tr key={order.id}><td><button className="order-link" onClick={()=>setDetail(order)}>#{order.id}</button></td><td><strong>{order.customerName}</strong></td><td>{order.phone}</td><td>{new Date(order.orderDate).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</td><td>{money(order.totalAmount)}</td><td><Badge value={order.paymentStatus}/></td><td><Badge value={order.status}/></td><td><div className="actions"><button onClick={()=>setDetail(order)}>View</button><button onClick={()=>openEdit(order)}>Edit</button><button className="danger-text" onClick={()=>cancelOrder(order)} disabled={order.status==="CANCELLED"}>Cancel</button></div></td></tr>)}
    </tbody></table></div>
    {formOpen && <div className="backdrop" onMouseDown={()=>setFormOpen(false)}><div className="order-modal form-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><h2>{editingId ? `Edit Order #${editingId}` : "New Order"}</h2><p>Creating an order does not reduce product stock.</p></div><button className="close" onClick={()=>setFormOpen(false)}>×</button></div>{error&&<div className="error">{error}</div>}
      <div className="field-grid"><Field name="Customer Name *" value={form.customerName} onChange={v=>setForm({...form,customerName:v})}/><Field name="Phone Number *" value={form.phone} onChange={v=>setForm({...form,phone:v})}/><label className="field full">Address *<textarea value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label><label className="field">Order Date<input type="date" value={String(form.orderDate)} onChange={e=>setForm({...form,orderDate:e.target.value})}/></label><label className="field">Payment Status<select value={form.paymentStatus} onChange={e=>setForm({...form,paymentStatus:e.target.value as PaymentStatus})}>{payments.map(s=><option key={s} value={s}>{label(s)}</option>)}</select></label>{editingId&&<label className="field">Order Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value as OrderStatus})}>{statuses.map(s=><option key={s} value={s}>{label(s)}</option>)}</select></label>}<label className="field full">Notes (optional)<textarea value={form.notes??""} onChange={e=>setForm({...form,notes:e.target.value})}/></label></div>
      <div className="items-editor"><h3>Ordered Items</h3><input placeholder="Search products to add..." value={productSearch} onChange={e=>setProductSearch(e.target.value)}/>{productSearch&&<div className="product-picker">{productResults.map(product=><button key={product.id} onClick={()=>{addProduct(product);setProductSearch("");}}><div className="product-picker-row"><div><span>{product.name}</span><small>{product.category?.name ?? "Uncategorized"}</small></div><div className="product-picker-meta"><strong>{money(product.sellingPrice)}</strong><span>Stock: {product.stockQty}</span></div></div></button>)}{!productResults.length&&<span>No products found.</span>}</div>}
      <div className="edit-items">{form.items.map((item,index)=><div className="edit-item" key={`${item.productId}-${index}`}><div><strong>{item.productName}</strong><span>{money(item.unitPrice)} × {item.quantity}</span></div><div className="qty"><button onClick={()=>quantity(index,-1)}>−</button><b>{item.quantity}</b><button onClick={()=>quantity(index,1)}>+</button></div><strong>{money(item.unitPrice*item.quantity)}</strong><button className="remove" onClick={()=>remove(index)}>Remove</button></div>)}</div><div className="form-total"><span>Total</span><strong>{money(total)}</strong></div></div>
      <div className="modal-actions"><button onClick={()=>setFormOpen(false)}>Cancel</button><button className="primary" disabled={saving} onClick={save}>{saving?"Saving...":editingId?"Save Changes":"Create Order"}</button></div>
    </div></div>}
    {detail&&<div className="backdrop" onMouseDown={()=>setDetail(null)}><div className="order-modal detail-modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><h2>Order #{detail.id}</h2><div className="badge-row"><Badge value={detail.paymentStatus}/><Badge value={detail.status}/></div></div><button className="close" onClick={()=>setDetail(null)}>×</button></div><div className="detail-grid"><section><h4>Customer</h4><p><span>Name</span><strong>{detail.customerName}</strong></p><p><span>Phone</span><strong>{detail.phone}</strong></p><p><span>Address</span><strong>{detail.address}</strong></p></section><section><h4>Order</h4><p><span>Date</span><strong>{new Date(detail.orderDate).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</strong></p><p><span>Status</span><strong>{label(detail.status)}</strong></p><p><span>Payment</span><strong>{label(detail.paymentStatus)}</strong></p></section></div>{detail.notes&&<div className="notes"><b>Notes</b><p>{detail.notes}</p></div>}<h4>Items</h4><table className="detail-items"><thead><tr><th>Product</th><th>Price</th><th>Qty</th><th>Subtotal</th></tr></thead><tbody>{detail.items.map((item,i)=><tr key={item.id??i}><td>{item.productName}</td><td>{money(item.unitPrice)}</td><td>{item.quantity}</td><td>{money(item.subtotal)}</td></tr>)}</tbody><tfoot><tr><td colSpan={3}>Total</td><td>{money(detail.totalAmount)}</td></tr></tfoot></table><div className="status-controls"><select value={detail.status} onChange={e=>changeStatus(detail,e.target.value as OrderStatus)}>{statuses.map(s=><option key={s} value={s}>{label(s)}</option>)}</select><button onClick={()=>changePayment(detail)}>Mark as {detail.paymentStatus==="PAID"?"Unpaid":"Paid"}</button></div><div className="modal-actions"><button className="delete" onClick={()=>deleteOrder(detail)}>Delete</button><button className="primary" onClick={()=>openEdit(detail)}>Edit Order</button></div></div></div>}
  </div></AppShell>;
}

function Badge({value}:{value:string}) { return <span className={`badge badge-${value.toLowerCase()}`}>{label(value)}</span>; }
function Field({name,value,onChange}:{name:string;value:string;onChange:(value:string)=>void}) { return <label className="field">{name}<input value={value} onChange={e=>onChange(e.target.value)}/></label>; }
