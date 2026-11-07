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

# Brooding

Brooding runs on the same pages and records as Broilers, as its own unit: its
own houses, batches, feed stock (the mill sends it feed on requests from
"Brooding"), expenses and team role. Its batches are layer breeds.

- **Dispatch** sends birds from a brooding batch to Layers or Broilers. To
  Broilers, it starts a Broilers batch in a broiler house with the birds'
  breed and age, and their weight at dispatch (or their last weighing) as the
  starting weight its gain is counted from.
- **Dispatch to Layers** sends birds from a brooding batch to a Layers hall.
  Each dispatch creates a new Layers batch (e.g. FOCUS 20) with the birds'
  breed and age, as a growing flock — mark it in lay on Layers → Batches when
  it starts laying. Weigh them on the way out if you can; it counts toward the
  batch's FCR. A dispatch can be deleted (the birds come back) until Layers
  records anything for the new flock.
- **Sales** sells brooded birds, invoiced as "Pullets", per bird or per kg.

# Ruminants

Goats, sheep and cattle, each by its tag.

| Page | What it's for |
| --- | --- |
| **Overview** | Animals on the farm by species and sex; born, sold, died this month; feed stock |
| **Animals** | The register: add an animal bought in, record a birth (each young gets its own tag, with its mother's species, breed and pen), record a death or cull, view an animal's weights, health and young. Admins correct and delete |
| **Weights** | An animal's weight, and its gain a day since the time before |
| **Health** | Vaccines, treatments and deworming, for one animal or many at once |
| **Feed** | Feed bought in and from the mill, by type, less what each species was given |
| **Sales** | Animals of one species sold at a price a head, on an invoice; deleting the invoice brings them back |
| **Expenses** | Wages, feed bought, medicine, maintenance |

# Health and the store

Health records in Broilers, Brooding and Ruminants can name what was drawn
from the unit's store location on Inventory, and how much (for Ruminants, how
much each animal had). It comes off Inventory at once, and deleting the record
puts it back. Move stock into the unit's location on Inventory first.

# Finance

The Finance monthly summary has a line for Broilers, Brooding and Ruminants:
sales, the feed they ate at the average cost of the feed each received,
expenses (with Broilers' cost of processing) and net, and the whole farm's net.
Birds Brooding sends to Layers or Broilers move inside the farm, so they
aren't sales.
