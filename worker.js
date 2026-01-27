export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    // ======================
    // NẠP THẺ CÀO
    // ======================
    if (url.pathname === "/card" && req.method === "POST") {
      const data = await req.json();

      const res = await fetch("https://thesieure.com/chargingws/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner_id: env.TSR_ID,
          partner_key: env.TSR_KEY,
          telco: data.telco,
          amount: data.amount,
          serial: data.serial,
          code: data.code,
          request_id: data.request_id
        })
      });

      return new Response(JSON.stringify(await res.json()), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // ======================
    // CALLBACK THẺ CÀO
    // ======================
    if (url.pathname === "/card-callback") {
      const data = await req.json();

      // status = 1 là thành công
      if (data.status == 1) {
        await fetch(env.FIREBASE_FUNCTION, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: data.request_id,
            amount: data.value,
            type: "card"
          })
        });
      }
      return new Response("OK");
    }

    // ======================
    // CHECK BANK / MOMO (Webhook tool trung gian)
    // ======================
    if (url.pathname === "/bank-callback") {
      const data = await req.json();
      const uid = data.content.replace("SNOW", "");

      await fetch(env.FIREBASE_FUNCTION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid,
          amount: data.amount,
          type: "bank"
        })
      });

      return new Response("OK");
    }

    return new Response("SNOW API OK");
  }
};
