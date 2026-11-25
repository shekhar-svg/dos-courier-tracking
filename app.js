/* Dos Electronics Courier Tracking - Supabase client */
(() => {
"use strict";
const $=id=>document.getElementById(id);
const STATUS=["Booked","Picked Up","In Transit","Out for Delivery","Delivered","Delivery Failed","Returned"];
let sb,session,profile,bookings=[],team=[];
const msg=(s)=>{const t=$("globalMsg");t.textContent=s;t.style.display="block";setTimeout(()=>t.style.display="none",3500)};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const statusClass=s=>s.replaceAll(" ","");
function showPage(page){document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));$(page+"Page").classList.remove("hidden");document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.page===page));$("pageTitle").textContent=({dashboard:"Dashboard",bookings:"Courier Bookings",new:"New Booking",users:"Team & Couriers"})[page];if(page==="bookings")renderBookings();if(page==="users")loadTeam();}
async function init(){
 if(!window.supabase||!window.SUPABASE_URL||!window.SUPABASE_PUBLISHABLE_KEY){$("loginMsg").textContent="Supabase configuration missing.";return;}
 sb=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);
 const {data:{session:s}}=await sb.auth.getSession();if(s){session=s;await enterApp();}
 sb.auth.onAuthStateChange(async(_event,s)=>{session=s;if(s)await enterApp();else leaveApp();});
}
async function login(e){e.preventDefault();$("loginMsg").textContent="Signing in...";const {error}=await sb.auth.signInWithPassword({email:$("email").value,password:$("password").value});$("loginMsg").textContent=error?error.message:"";}
async function enterApp(){
 const {data,error}=await sb.from("courier_profiles").select("*").eq("id",session.user.id).single();
 if(error||!data){$("loginMsg").textContent="Profile not found. Run supabase_setup.sql and ask admin to activate your profile.";await sb.auth.signOut();return;}
 if(!data.active){$("loginMsg").textContent="Your account is inactive. Contact administrator.";await sb.auth.signOut();return;}
 profile=data;$("loginView").classList.add("hidden");$("appView").classList.remove("hidden");
 document.body.classList.toggle("is-admin",profile.role==="admin");
 $("userName").textContent=profile.full_name||session.user.email;$("userRole").textContent=profile.role;$("sideUser").textContent=(profile.full_name||session.user.email)+" · "+profile.role;
 await loadBookings();showPage("dashboard");
}
function leaveApp(){$("appView").classList.add("hidden");$("loginView").classList.remove("hidden");}
async function loadBookings(){
 let q=sb.from("courier_bookings").select("*,assignee:courier_profiles!courier_bookings_assigned_to_fkey(full_name)").order("created_at",{ascending:false}).limit(500);
 const {data,error}=await q;if(error){msg(error.message);return;}bookings=data||[];renderDashboard();renderBookings();
}
function renderDashboard(){
 const rows=bookings;$("statTotal").textContent=rows.length;$("statTransit").textContent=rows.filter(x=>["Picked Up","In Transit","Out for Delivery"].includes(x.status)).length;$("statDelivered").textContent=rows.filter(x=>x.status==="Delivered").length;$("statPending").textContent=rows.filter(x=>["Booked","Delivery Failed","Returned"].includes(x.status)).length;
 $("recentList").innerHTML=tableHTML(rows.slice(0,8));
}
function tableHTML(rows){if(!rows.length)return '<p class="muted">No courier bookings found.</p>';return `<table><thead><tr><th>Booking</th><th>Receiver</th><th>Courier / AWB</th><th>Assigned to</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.booking_no)}</b><br><span class="muted">${new Date(r.created_at).toLocaleDateString()}</span></td><td>${esc(r.receiver_name)}<br><span class="muted">${esc(r.receiver_phone)}</span></td><td>${esc(r.courier_company||"—")}<br>${esc(r.awb_number||"—")}</td><td>${esc(r.assignee?.full_name||"Unassigned")}</td><td><span class="status ${statusClass(r.status)}">${esc(r.status)}</span></td><td><button class="secondary" data-detail="${r.id}">Open</button></td></tr>`).join("")}</tbody></table>`}
function renderBookings(){const term=($("searchBox")?.value||"").toLowerCase(),st=$("statusFilter")?.value||"";const rows=bookings.filter(r=>(!st||r.status===st)&&[r.booking_no,r.receiver_name,r.awb_number,r.courier_company].join(" ").toLowerCase().includes(term));$("bookingList").innerHTML=tableHTML(rows);}
async function createBooking(e){
 e.preventDefault();const f=new FormData(e.target),v=Object.fromEntries(f.entries());const payload={...v,created_by:session.user.id,status:"Booked"};
 const {data,error}=await sb.from("courier_bookings").insert(payload).select().single();
 if(error){$("bookingMsg").textContent=error.message;return;}
 $("bookingMsg").textContent="Booking saved: "+data.booking_no;e.target.reset();await loadBookings();showPage("bookings");
}
async function loadTeam(){if(profile.role!=="admin")return;const {data,error}=await sb.from("courier_profiles").select("id,full_name,phone,role,active").order("full_name");if(error){$("teamList").textContent=error.message;return;}team=data||[];$("teamList").innerHTML=team.length?`<table><thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Active</th></tr></thead><tbody>${team.map(x=>`<tr><td><b>${esc(x.full_name||"—")}</b></td><td>${esc(x.phone||"—")}</td><td>${esc(x.role)}</td><td>${x.active?"Yes":"No"}</td></tr>`).join("")}</tbody></table>`:"No profiles yet.";}
async function openDetail(id){
 const r=bookings.find(x=>x.id===id);if(!r)return;
 const canAssign=profile.role==="admin";
 let options=STATUS.map(s=>`<option ${s===r.status?"selected":""}>${s}</option>`).join("");
 let couriers=team.filter(x=>x.role==="courier"&&x.active);
 if(canAssign&&!team.length){const {data}=await sb.from("courier_profiles").select("id,full_name,role,active");team=data||[];couriers=team.filter(x=>x.role==="courier"&&x.active);}
 $("detailBody").innerHTML=`<div class="detail-grid">
 ${item("Booking",r.booking_no)}${item("Status",r.status)}${item("Sender",r.sender_name)}${item("Sender phone",r.sender_phone)}${item("Receiver",r.receiver_name)}${item("Receiver phone",r.receiver_phone)}${item("Address",r.receiver_address)}${item("Courier company",r.courier_company)}${item("AWB number",r.awb_number)}${item("Parcel",r.parcel_description)}${item("Notes",r.notes)}
 </div><div class="dialog-actions">${r.tracking_url?`<a class="primary" style="text-decoration:none;padding:11px;border-radius:8px" target="_blank" rel="noopener" href="${esc(r.tracking_url)}">Open carrier tracking</a>`:""}${canAssign?`<select id="assignSelect"><option value="">Unassign courier</option>${couriers.map(c=>`<option value="${c.id}" ${c.id===r.assigned_to?"selected":""}>${esc(c.full_name)}</option>`).join("")}</select><button class="secondary" id="assignBtn">Save assignment</button>`:""}${profile.role==="courier"&&r.assigned_to===profile.id?`<select id="statusSelect">${options}</select><button class="primary" id="statusBtn">Update status</button>`:""}</div>`;
 $("detailDialog").showModal();
 $("assignBtn")?.addEventListener("click",()=>assign(r.id));
 $("statusBtn")?.addEventListener("click",()=>updateStatus(r.id));
}
function item(k,v){return `<div class="detail-item"><small>${esc(k)}</small>${esc(v||"—")}</div>`}
async function assign(id){const val=$("assignSelect").value||null;const {error}=await sb.from("courier_bookings").update({assigned_to:val}).eq("id",id);if(error){msg(error.message);return;}msg("Courier assignment saved.");$("detailDialog").close();await loadBookings();}
async function updateStatus(id){const status=$("statusSelect").value;const {error}=await sb.rpc("courier_update_status",{p_booking_id:id,p_status:status,p_note:"Updated by courier"});if(error){msg(error.message);return;}msg("Delivery status updated.");$("detailDialog").close();await loadBookings();}
document.addEventListener("click",e=>{const d=e.target.closest("[data-detail]");if(d)openDetail(d.dataset.detail);const g=e.target.closest("[data-goto]");if(g)showPage(g.dataset.goto);const n=e.target.closest("[data-page]");if(n)showPage(n.dataset.page);});
$("loginForm").addEventListener("submit",login);$("bookingForm").addEventListener("submit",createBooking);$("logoutBtn").addEventListener("click",()=>sb.auth.signOut());$("closeDialog").addEventListener("click",()=>$("detailDialog").close());$("searchBox").addEventListener("input",renderBookings);$("statusFilter").addEventListener("change",renderBookings);
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js").catch(()=>{});
init();
})();