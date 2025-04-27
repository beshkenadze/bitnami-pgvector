import pg from 'pg';

const { Client } = pg;
console.log("Test environment variables:");
console.log(`PGHOST: ${process.env.PGHOST || 'localhost'}`);
console.log(`PGPORT: ${process.env.PGPORT || 5432}`);
console.log(`PGUSER: ${process.env.PGUSER || 'postgres'}`);
console.log(`PGDATABASE: ${process.env.PGDATABASE || 'postgres'}`);
console.log(`Password is ${process.env.PGPASSWORD ? 'set' : 'not set'}`);

const pgclient = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE
});

pgclient.connect();

const table = 'CREATE TABLE student(id SERIAL PRIMARY KEY, firstName VARCHAR(40) NOT NULL, lastName VARCHAR(40) NOT NULL, age INT, address VARCHAR(80), email VARCHAR(40))'
const text = 'INSERT INTO student(firstname, lastname, age, address, email) VALUES($1, $2, $3, $4, $5) RETURNING *'
const values = ['Mona the', 'Octocat', 9, '88 Colin P Kelly Jr St, San Francisco, CA 94107, United States', 'octocat@github.com']

pgclient.query(table, (err, res) => {
    if (err) throw err
});

pgclient.query(text, values, (err, res) => {
    if (err) throw err
});

pgclient.query('SELECT * FROM student', (err, res) => {
    if (err) throw err
    console.log(err, res.rows) // Print the data in student table
    pgclient.end()
});
