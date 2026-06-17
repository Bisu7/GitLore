import * as neo4j from 'neo4j-driver';
import { Driver } from 'neo4j-driver';

const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const username = process.env.NEO4J_USERNAME || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'password';

let driver: Driver | null = null;

export const getNeo4jDriver = () => {
    if (!driver) {
        driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
    }
    return driver;
};

export const closeNeo4jDriver = async () => {
    if (driver) {
        await driver.close();
        driver = null;
    }
};
