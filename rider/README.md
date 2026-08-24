4) Wire ride requests to your backend
Wherever you currently “request a ride”, use your existing api import:

```ts
import { api } from '../services/api';

const { data } = await api.post('/rides', {
  pickup: { lat: 43.6532, lng: -79.3832 },
  dropoff: { lat: 43.6426, lng: -79.3871 },
});
// data.id, data.status, etc.
```