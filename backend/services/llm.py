"""LLM service — single entry point for all LLM calls.

Every node that needs an LLM should call functions from this module
rather than importing openai directly.  This makes it easy to:
  - swap providers (OpenAI → Anthropic)
  - add retries / rate-limit handling in one place
  - mock in tests

Usage:
    from backend.services.llm import call_llm, call_llm_json
    text = await call_llm("Summarize this file", file_content)
    data = await call_llm_json("Return JSON", schema_prompt)
"""

from __future__ import annotations

import json
import logging
from typing import Any

from openai import AsyncOpenAI

from backend.config import settings

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


async def call_llm(
    system_prompt: str,
    user_prompt: str,
    *,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> str:
    """Send a chat completion request and return the text response.

    Args:
        system_prompt: The system message setting the task context.
        user_prompt:   The user message with the actual content.
        model:         Override the default model from settings.
        temperature:   Override the default temperature.
        max_tokens:    Override the default max_tokens.

    Returns:
        The assistant's response as a string.
    """
    client = _get_client()
    used_model = model or settings.LLM_MODEL
    logger.info(
        "LLM call: model=%s, system_len=%d, user_len=%d",
        used_model, len(system_prompt), len(user_prompt),
    )
    try:
        response = await client.chat.completions.create(
            model=used_model,
            temperature=temperature if temperature is not None else settings.LLM_TEMPERATURE,
            max_completion_tokens=max_tokens or settings.LLM_MAX_TOKENS,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        result = response.choices[0].message.content or ""
        logger.info("LLM response: %d chars", len(result))
        return result
    except Exception as e:
        logger.error("LLM call FAILED: %s", e)
        raise


async def call_llm_json(
    system_prompt: str,
    user_prompt: str,
    *,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> dict[str, Any]:
    """Call the LLM and parse the response as JSON.

    Uses response_format=json_object to guarantee valid JSON output.
    Falls back to extracting JSON from markdown fences if the model
    doesn't support response_format.
    """
    client = _get_client()
    used_model = model or settings.LLM_MODEL
    logger.info(
        "LLM JSON call: model=%s, system_len=%d, user_len=%d",
        used_model, len(system_prompt), len(user_prompt),
    )
    try:
        response = await client.chat.completions.create(
            model=used_model,
            temperature=temperature if temperature is not None else settings.LLM_TEMPERATURE,
            max_completion_tokens=max_tokens or settings.LLM_MAX_TOKENS,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
        raw = response.choices[0].message.content or ""
        logger.info("LLM JSON response: %d chars", len(raw))
    except Exception as e:
        logger.error("LLM JSON call FAILED: %s", e)
        raise

    # Try direct parse first
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Try extracting from ```json ... ``` fences
    if "```json" in raw:
        start = raw.index("```json") + len("```json")
        end = raw.index("```", start)
        try:
            return json.loads(raw[start:end].strip())
        except json.JSONDecodeError:
            pass

    # Try extracting from ``` ... ``` fences
    if "```" in raw:
        start = raw.index("```") + 3
        end = raw.index("```", start)
        try:
            return json.loads(raw[start:end].strip())
        except json.JSONDecodeError:
            pass

    logger.error("Failed to parse LLM JSON response: %s", raw[:200])
    raise ValueError(f"LLM did not return valid JSON. Raw: {raw[:500]}")
