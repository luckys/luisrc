import json
import unittest
from pathlib import Path

from pydantic import ValidationError
from validation import ReservationInput


class ValidationTests(unittest.TestCase):
    def test_shared_json_cases(self):
        cases = json.loads(Path("cases.json").read_text())
        for case in cases:
            with self.subTest(case=case["name"]):
                try:
                    ReservationInput.model_validate(case["input"])
                    valid = True
                except ValidationError:
                    valid = False
                self.assertEqual(valid, case["valid"])

    def test_absent_is_not_null_and_defaults_do_not_appear(self):
        data = {"sku": "BOOK", "quantity": 2, "expectedVersion": 1, "priority": "standard"}
        parsed = ReservationInput.model_validate(data)
        self.assertEqual(parsed.model_dump(exclude_unset=True), data)
        with self.assertRaises(ValidationError):
            ReservationInput.model_validate({**data, "note": None})

    def test_code_points_and_integral_json_numbers(self):
        data = {"sku": "BOOK", "quantity": 2.0, "expectedVersion": 1.0, "priority": "standard"}
        self.assertEqual(ReservationInput.model_validate(data).quantity, 2)
        ReservationInput.model_validate({**data, "note": "📚" * 80})
        with self.assertRaises(ValidationError):
            ReservationInput.model_validate({**data, "note": "📚" * 81})

    def test_independent_field_errors_accumulate(self):
        with self.assertRaises(ValidationError) as caught:
            ReservationInput.model_validate({"sku": "book", "quantity": 0, "expectedVersion": "1", "priority": "urgent"})
        self.assertEqual({error["loc"][0] for error in caught.exception.errors()}, {"sku", "quantity", "expectedVersion", "priority"})


if __name__ == "__main__":
    unittest.main()
