import { FastifyInstance } from "fastify";

export default async function integrationRoutes(fastify: FastifyInstance) {
    fastify.get('/integrations/jira/connect', {})
}