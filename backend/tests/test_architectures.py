import io
import pytest
import torch
from backend.thinknet_architectures import (
    MLP, DecoderTransformerLM, VisionTransformerClassifier, ConvNetClassifier,
    architecture_catalog, build_architecture, count_parameters,
)

def _optimizer_step(model, loss):
    before = next(model.parameters()).detach().clone()
    loss.backward()
    optimizer = torch.optim.SGD(model.parameters(), lr=0.01)
    optimizer.step()
    assert not torch.equal(before, next(model.parameters()).detach())

def test_mlp_forward_backward_and_validation():
    model = MLP(12, 3, hidden_dims=(16, 8))
    y = model(torch.randn(4, 12))
    assert y.shape == (4, 3)
    _optimizer_step(model, y.square().mean())
    with pytest.raises(ValueError, match="final dimension"):
        model(torch.randn(2, 5))
    with pytest.raises(ValueError, match="positive integer"):
        MLP(0, 3)

def test_decoder_lm_logits_loss_gradients_and_validation():
    torch.manual_seed(7)
    model = DecoderTransformerLM(vocab_size=31, d_model=16, num_layers=2, num_heads=4, max_seq_len=12)
    tokens = torch.randint(0, 31, (2, 7))
    logits, loss = model(tokens, tokens)
    assert logits.shape == (2, 7, 31) and loss.ndim == 0 and torch.isfinite(loss)
    _optimizer_step(model, loss)
    with pytest.raises(ValueError, match="Token IDs"):
        model(torch.tensor([[31, 1]]))
    with pytest.raises(ValueError, match="max_seq_len"):
        model(torch.ones((1, 13), dtype=torch.long))

def test_vit_and_cnn_forward_backward():
    vit = VisionTransformerClassifier(image_size=16, patch_size=4, num_classes=5, d_model=16, num_layers=1, num_heads=4)
    logits = vit(torch.randn(2, 3, 16, 16))
    assert logits.shape == (2, 5)
    _optimizer_step(vit, logits.square().mean())
    cnn = ConvNetClassifier(num_classes=5, base_channels=4)
    logits = cnn(torch.randn(2, 3, 32, 32))
    assert logits.shape == (2, 5)
    _optimizer_step(cnn, logits.square().mean())

def test_factory_catalog_and_state_dict_round_trip():
    assert {x["name"] for x in architecture_catalog()} == {"mlp", "decoder_transformer_lm", "vit_classifier", "cnn_classifier"}
    config = {"input_dim": 4, "output_dim": 2, "hidden_dims": [8]}
    model = build_architecture("mlp", config)
    assert count_parameters(model) >= count_parameters(model, trainable_only=True) > 0
    stream = io.BytesIO(); torch.save(model.state_dict(), stream); stream.seek(0)
    restored = build_architecture("mlp", config)
    restored.load_state_dict(torch.load(stream, weights_only=True))
    x = torch.randn(3, 4)
    torch.testing.assert_close(model(x), restored(x))
    with pytest.raises(ValueError, match="Unknown architecture"):
        build_architecture("not-a-model")
