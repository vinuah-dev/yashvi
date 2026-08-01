# Biometric Server — Cloud Deploy Guide (ek baar ka kaam)

Isko ek baar cloud pe daal do, phir laptop/terminal ki kabhi zaroorat nahi.
Machine mein ek fixed address daal do — hamesha kaam karega.

---

## Kya chahiye (2 cheezein)
1. Supabase URL:  `https://YOUR-PROJECT.supabase.co`
2. Supabase Service Role Key
   - Supabase Dashboard → Settings → API → **service_role** key (secret wala)

Yeh dono Railway/Render mein "Environment Variables" me daalne hain.

---

## Option A — Railway (sabse aasaan, recommended)

1. https://railway.app pe jao, GitHub se sign up karo.
2. **New Project → Deploy from GitHub repo** → apna repo select karo.
3. Railway repo ke andar `biometric-server` folder ko service bana lega.
   - Agar poora repo select hua ho, to service settings me **Root Directory** = `biometric-server` set kar do.
4. **Variables** tab me ye do env vars add karo:
   - `SUPABASE_URL` = tumhara Supabase URL
   - `SUPABASE_SERVICE_ROLE_KEY` = service role key
   - (PORT khud set ho jaata hai, haath mat lagao)
5. Deploy hone do. Ho jaane par **Settings → Networking → Generate Domain** dabao.
   - Ek URL milega jaise:  `your-app.up.railway.app`
6. Bas! Yeh URL note kar lo.

---

## Option B — Render (free tier bhi hai)

1. https://render.com pe jao, GitHub se sign up.
2. **New → Web Service** → apna repo connect karo.
3. Settings:
   - **Root Directory**: `biometric-server`
   - **Build Command**: `npm ci`
   - **Start Command**: `node server.js`
4. **Environment** me add karo:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Create Web Service. Deploy ke baad ek URL milega jaise:
   `your-app.onrender.com`

---

## Deploy hone ke baad — test karo
Browser me kholo (apna URL laga ke):
```
https://your-app.up.railway.app/health
```
"OK" jaisa response aaye = server chal raha hai. 

---

## Har gym ki F22 machine me settings

Menu → Comm → Cloud Server Setting:

- **Server Mode**        = ADMS
- **Enable Domain Name** = ON
- **Server Address**     = your-app.up.railway.app   (bina https:// ke)
- **Server Port**        = 443     (HTTPS ke liye)   [agar 443 kaam na kare to 80 try karo]
- **Enable Proxy**       = OFF

Save → machine restart.

Ab finger punch karke app ke "Biometric Devices" page pe dekho — device Online ho jayega aur attendance aa jayegi.

---

## Yaad rakho
- Ek hi server saare gyms ke liye kaam karta hai (multi-gym support already hai).
- Har nayi machine bas app ke Settings → Biometric Devices me register karni hai (Serial Number se).
- Server cloud pe hai to laptop band ho, WiFi badle — kuch farak nahi padta.
