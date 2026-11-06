# Broilers

Broilers are kept apart from Layers: their own houses, batches, feed stock and
records. A batch is placed in a house as chicks and closes once its last
birds are sold, died or culled. Broilers admins correct and delete; staff record.

| Page | What it's for |
| --- | --- |
| **Overview** | Birds alive, feed stock and days cover, deaths this week, and each growing batch's age, weight, FCR, liveability and EPEF |
| **Daily entry** | One line per batch: feed (bags), water, mortality, culls, and a sample weighed. Everything saves together, or nothing does |
| **Batches** | Add, correct, close or delete batches; add and rename houses |
| **Weighing** | Samples weighed: birds and their weight together give the average, and the gain a day since the last weighing |
| **Feed** | Feed bought in + sent by the mill − used, in total and by feed type. Ask the mill on Feed requests |
| **Health** | Vaccines and medication given to each batch |
| **Processing** | Birds processed: live weight in; carcass, head and feet and gizzard out into store, with the cost of processing and the yield |
| **Sales** | Live birds (per bird or per kg live weight) and processed chicken from store (by the kg, or carcass by the bird), each on an invoice with payments, receipts and the buyer's portal like any other sale. The sales unit can record these too |
| **Expenses** | Salary and wages, brooding paper and sawdust, medication and vaccines, charcoal and gas, maintenance — for all broilers or one batch |
| **Analysis** | Every batch side by side, with a CSV |

## How the figures are worked out

- **Feed types** are the mill's products (Feed mill → Products). Each
  delivery and each day's feed names its type; feed of a type can't be used
  beyond what's on hand of it (feed from before types were kept can make up
  the difference).
- **Birds processed** leave their batch like a sale, at their live weight.
  **Yield** = carcass ÷ live weight. Processed chicken in store = what
  processing gave − what was sold, part by part.

- **Birds alive** = placed − died − culled − sold.
- **Average weight** = the last sample's weight ÷ birds weighed. For a closed
  batch it's the average weight sold.
- **Liveability** = birds that didn't die or get culled ÷ birds placed.
- **FCR** = feed ÷ live weight produced, where live weight produced = weight
  sold + birds on the farm at their last average − the chicks' weight on
  arrival (set on the batch, 40 g by default). Lower is better.
- **EPEF** = liveability % × weight in kg × 100 ÷ (age in days × FCR). Higher
  is better.
- **Age** counts from the arrival date plus the age on arrival.

Broiler and processed chicken invoices don't appear on Layers' Sales & invoices; they show on
Broilers → Sales, on the buyer's account and in Payments. Broiler staff see
only broiler invoices.
