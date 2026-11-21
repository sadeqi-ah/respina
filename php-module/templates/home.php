<section class="card narrow">
    <h1>Open a customer</h1>
    <form method="get" action="/customers" class="inline">
        <label>Customer ID
            <input type="text" name="id" inputmode="numeric" pattern="[1-9][0-9]{0,17}" required>
        </label>
        <button type="submit" class="primary">Open</button>
    </form>
</section>
