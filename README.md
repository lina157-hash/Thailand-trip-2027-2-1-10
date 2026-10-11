# 泰好時光｜2027 曼谷・芭達雅

2027/2/1–2/10 旅行手帳網站，放在 GitHub Pages 上。頁面、樣式、每日行程、旅遊靈感、旅費記帳、出發清單都和原本的 ChatGPT 網站相同；差別只在「共同行程」改存在這個儲存庫的 `trip.json`，主辦人改用 GitHub 權杖登入。

## 檔案

| 檔案 | 用途 |
| --- | --- |
| `index.html`、`style.css` | 頁面與樣式 |
| `app.js` | 每日行程、旅遊靈感、旅費記帳、出發清單、個人備份（與原站完全相同） |
| `trip-data.js` | 頁面剛載入時顯示的預設行程（與原站完全相同） |
| `cloud.js` | 共同行程同步、主辦人登入與編輯（GitHub 版） |
| `trip.json` | 目前的共同行程。主辦人在網站上儲存時會自動更新 |

## 開啟網站（只需做一次）

1. 到這個儲存庫的 **Settings → Pages**。
2. **Build and deployment** 的 **Source** 選 **Deploy from a branch**。
3. **Branch** 選 `main`、資料夾選 `/ (root)`，按 **Save**。
4. 約一分鐘後，網址是 `https://<GitHub 帳號>.github.io/<儲存庫名稱>/`，把它傳給旅伴即可。

## 主辦人登入

主辦人需要一組只能寫入這個儲存庫的 GitHub 權杖（fine-grained personal access token）。

1. 登入 GitHub，開啟 <https://github.com/settings/personal-access-tokens/new>
   （頭像 → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token）。
2. **Token name** 自訂，例如 `thai-days-host`。
3. **Expiration** 建議設在旅程結束後不久，例如 2027-02-28。
4. **Repository access** 選 **Only select repositories**，只勾選這個儲存庫。
5. **Permissions → Repository permissions → Contents** 設為 **Read and write**（Metadata 會自動變成 Read-only，其他都不用開）。
6. 按 **Generate token**，複製 `github_pat_` 開頭的字串。
7. 回到網站按 **主辦人登入**，貼上權杖。登入後右上角會出現 **編輯共同行程**。

請注意：

- 權杖就是這個儲存庫的寫入鑰匙，請不要傳給別人，也不要貼到聊天室。如果外流，回到上面的頁面把它刪除（Delete／Revoke）就會立刻失效。
- 權杖只保存在登入時使用的那個瀏覽器，只會傳送給 `api.github.com`。按 **登出** 會把它從該瀏覽器移除。
- 換手機或電腦要再貼一次。在別人的裝置上登入時，請取消勾選「在這個裝置保持登入」。

## 編輯與同步

- 按 **編輯共同行程** → 修改 → **儲存並同步給旅伴**。每次儲存都是這個儲存庫的一筆 commit。
- 主辦人自己的畫面會立刻更新。旅伴的頁面每 15 秒檢查一次，但 GitHub Pages 重新發布需要時間，所以旅伴大約一兩分鐘後才會看到新內容。
- GitHub Pages 每小時大約可發布 10 次（軟性上限）。短時間內連續儲存很多次，旅伴看到更新的時間可能延後；建議改完幾處再一次儲存。
- 兩個裝置同時編輯時，比較晚儲存的那一方會被擋下並提示重新同步，不會互相覆蓋。

## 還原舊版本

每次儲存都有紀錄：在儲存庫點 `trip.json` → **History**，可以看到每一版改了什麼。要還原時，開啟想要的那一版，複製內容貼回 `trip.json` 再 commit 即可；旅伴的頁面會自動跟上。

## 隱私

- 免費帳號的 GitHub Pages 需要公開的儲存庫，所以網站和 `trip.json` 都是「拿到網址就能看」。請不要在行程裡寫護照號碼、訂位代號、電話等個人資料。
- 頁面加了 `noindex`，請搜尋引擎不要收錄；這不是存取控制。
- 從網站儲存時，commit 作者會記為「泰好時光 主辦人」，不帶出主辦人的 GitHub 信箱（萬一 GitHub 不接受這個作者名稱，網站會改用你的帳號身分儲存）。直接在 GitHub 網頁上編輯檔案時，作者則一定是你的帳號。不想讓信箱出現在公開的歷史紀錄，建議先到 GitHub 的 **Settings → Emails** 勾選 **Keep my email addresses private**。
- 旅伴的旅費與勾選狀態只存在各自的瀏覽器，不會上傳到任何地方。

## 自訂網域或子資料夾

`cloud.js` 會從網址（`https://帳號.github.io/儲存庫/`）自動判斷要寫回哪個儲存庫。如果改用自訂網域，或把網站放在儲存庫的子資料夾，請在 `cloud.js` 最上方的 `GH` 填入 `owner`、`repo`、`path`（例如 `docs/trip.json`）。
